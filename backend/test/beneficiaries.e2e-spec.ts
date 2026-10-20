import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { MockMailProvider } from '../src/common/mail/mock-mail.provider';
import { PrismaService } from '../src/prisma/prisma.service';

async function registerVerified(
  server: App,
  user: { email: string; password: string; fullName: string; phone?: string },
): Promise<{ accessToken: string; refreshToken: string }> {
  await request(server)
    .post('/api/auth/register')
    .send({
      ...user,
      phone: user.phone ?? '080' + String(Math.floor(Math.random() * 90_000_000) + 10_000_000),
      termsAccepted: true,
      termsVersion: 'e2e',
    })
    .expect(201);
  const code = MockMailProvider.lastCodeFor(user.email);
  if (!code) throw new Error('No verification code captured for ' + user.email);
  const res = await request(server)
    .post('/api/auth/verify-otp')
    .send({ email: user.email, code })
    .expect(201);
  return { accessToken: res.body.accessToken, refreshToken: res.body.refreshToken };
}

describe('Beneficiaries + change password (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const userA = { email: `ben-a-${suffix}@test.local`, password: 'Password123!', fullName: 'Beneficiary A' };
  const userB = { email: `ben-b-${suffix}@test.local`, password: 'Password123!', fullName: 'Beneficiary B' };
  let sessionA: { accessToken: string; refreshToken: string };
  let sessionB: { accessToken: string; refreshToken: string };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = moduleRef.get(PrismaService);
    sessionA = await registerVerified(app.getHttpServer(), userA);
    sessionB = await registerVerified(app.getHttpServer(), userB);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('beneficiaries', () => {
    let id: string;

    it('requires authentication', async () => {
      await request(app.getHttpServer()).get('/api/beneficiaries').expect(401);
    });

    it('creates a beneficiary and normalises +234 numbers', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/beneficiaries')
        .set('Authorization', `Bearer ${sessionA.accessToken}`)
        .send({ label: 'Mum', phoneNumber: '+2348012345678', network: 'mtn' })
        .expect(201);
      expect(res.body).toMatchObject({ label: 'Mum', phoneNumber: '08012345678', network: 'MTN' });
      id = res.body.id;
    });

    it('rejects invalid numbers and unsupported networks', async () => {
      await request(app.getHttpServer())
        .post('/api/beneficiaries')
        .set('Authorization', `Bearer ${sessionA.accessToken}`)
        .send({ phoneNumber: '12345', network: 'MTN' })
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/beneficiaries')
        .set('Authorization', `Bearer ${sessionA.accessToken}`)
        .send({ phoneNumber: '08012345678', network: 'AIRTEL_5G' })
        .expect(400);
    });

    it('upserts the same number+network instead of duplicating', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/beneficiaries')
        .set('Authorization', `Bearer ${sessionA.accessToken}`)
        .send({ label: 'Mother', phoneNumber: '08012345678', network: 'MTN' })
        .expect(201);
      expect(res.body.id).toBe(id);
      expect(res.body.label).toBe('Mother');
      const list = await request(app.getHttpServer())
        .get('/api/beneficiaries')
        .set('Authorization', `Bearer ${sessionA.accessToken}`)
        .expect(200);
      expect(list.body).toHaveLength(1);
    });

    it('does not leak or let another user modify the beneficiary', async () => {
      const listB = await request(app.getHttpServer())
        .get('/api/beneficiaries')
        .set('Authorization', `Bearer ${sessionB.accessToken}`)
        .expect(200);
      expect(listB.body).toHaveLength(0);

      await request(app.getHttpServer())
        .patch(`/api/beneficiaries/${id}`)
        .set('Authorization', `Bearer ${sessionB.accessToken}`)
        .send({ label: 'Hijacked' })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/api/beneficiaries/${id}`)
        .set('Authorization', `Bearer ${sessionB.accessToken}`)
        .expect(404);
    });

    it('updates and deletes the beneficiary for its owner', async () => {
      const updated = await request(app.getHttpServer())
        .patch(`/api/beneficiaries/${id}`)
        .set('Authorization', `Bearer ${sessionA.accessToken}`)
        .send({ label: 'Mama', network: 'GLO' })
        .expect(200);
      expect(updated.body).toMatchObject({ label: 'Mama', network: 'GLO', phoneNumber: '08012345678' });

      await request(app.getHttpServer())
        .delete(`/api/beneficiaries/${id}`)
        .set('Authorization', `Bearer ${sessionA.accessToken}`)
        .expect(200);

      const list = await request(app.getHttpServer())
        .get('/api/beneficiaries')
        .set('Authorization', `Bearer ${sessionA.accessToken}`)
        .expect(200);
      expect(list.body).toHaveLength(0);
    });
  });

  describe('change password', () => {
    it('rejects a wrong current password with 400 (not 401, which would kill the session)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${sessionA.accessToken}`)
        .send({ currentPassword: 'WrongPassword1!', newPassword: 'NewPassword123!' })
        .expect(400);
    });

    it('rejects reusing the current password and short passwords', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${sessionA.accessToken}`)
        .send({ currentPassword: userA.password, newPassword: userA.password })
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${sessionA.accessToken}`)
        .send({ currentPassword: userA.password, newPassword: 'short' })
        .expect(400);
    });

    it('changes the password, revokes refresh tokens, and invalidates the old password', async () => {
      const newPassword = 'BrandNewPass123!';
      await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${sessionA.accessToken}`)
        .send({ currentPassword: userA.password, newPassword })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: userA.email, password: userA.password })
        .expect(401);

      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: userA.email, password: newPassword })
        .expect(201);
      expect(login.body.accessToken).toBeTruthy();

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: sessionA.refreshToken })
        .expect(401);

      const dbUser = await prisma.user.findUniqueOrThrow({ where: { email: userA.email } });
      const audit = await prisma.auditLog.findFirst({
        where: { actorId: dbUser.id, entityType: 'User', entityId: dbUser.id, action: 'UPDATE', metadata: { path: ['event'], equals: 'password.change' } },
      });
      expect(audit).toBeTruthy();
    });
  });
});
