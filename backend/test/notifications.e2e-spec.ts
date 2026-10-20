import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { MockMailProvider } from '../src/common/mail/mock-mail.provider';
import { PrismaService } from '../src/prisma/prisma.service';

async function registerVerified(server: App, user: { email: string; password: string; fullName: string }): Promise<string> {
  await request(server)
    .post('/api/auth/register')
    .send({ ...user, phone: '080' + String(Math.floor(Math.random() * 90_000_000) + 10_000_000), termsAccepted: true, termsVersion: 'e2e' })
    .expect(201);
  const code = MockMailProvider.lastCodeFor(user.email);
  if (!code) throw new Error('No verification code captured for ' + user.email);
  const res = await request(server).post('/api/auth/verify-otp').send({ email: user.email, code }).expect(201);
  return res.body.accessToken as string;
}

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  const user = { email: `notif-${Date.now()}@test.local`, password: 'Password123!', fullName: 'Notify User' };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = moduleRef.get(PrismaService);
    token = await registerVerified(app.getHttpServer(), user);

    await request(app.getHttpServer())
      .post('/api/security/pin')
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: '1234' })
      .expect(201);

    const wallet = await prisma.walletAccount.findFirstOrThrow({ where: { user: { email: user.email } } });
    await prisma.walletAccount.update({ where: { id: wallet.id }, data: { balance: 10_000 } });

    await request(app.getHttpServer())
      .post('/api/orders/airtime')
      .set('Authorization', `Bearer ${token}`)
      .send({ network: 'MTN', phoneNumber: '08010000000', amount: 100, idempotencyKey: `notif-order-${Date.now()}`, pin: '1234' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates an unread notification when a purchase reaches a final state', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.length).toBeGreaterThan(0);
    const purchase = list.body.find((item: { category: string }) => item.category === 'order');
    expect(purchase).toMatchObject({ title: 'Purchase successful' });
    expect(purchase.metadata.orderId).toBeTruthy();

    const unread = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(unread.body.count).toBeGreaterThan(0);
  });

  it('marks one notification read and then all as read', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const first = list.body[0];

    await request(app.getHttpServer())
      .post(`/api/notifications/${first.id}/read`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/notifications/read-all')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const unread = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(unread.body.count).toBe(0);
  });

  it('does not expose another user’s notifications', async () => {
    const otherToken = await registerVerified(app.getHttpServer(), {
      email: `notif-other-${Date.now()}@test.local`,
      password: 'Password123!',
      fullName: 'Other User',
    });
    const list = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(list.body).toHaveLength(0);
  });
});
