import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockMailProvider } from '../src/common/mail/mock-mail.provider';

describe('Auth throttling (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emails = {
    customer: `throttle-customer-${stamp}@test.local`,
    admin: `throttle-admin-${stamp}@test.local`,
    otp: `throttle-otp-${stamp}@test.local`,
    reset: `throttle-reset-${stamp}@test.local`,
    owner: `throttle-owner-${stamp}@test.local`,
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.otpRateLimit.deleteMany({
      where: { OR: Object.values(emails).map((email) => ({ key: { contains: email } })) },
    });
    await app.close();
  });

  it('locks a customer account after five failed logins', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: emails.customer, password: 'WrongPassword123!' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: emails.customer, password: 'WrongPassword123!' })
      .expect(429);
  });

  it('still lets the real owner in after an attacker triggers the lockout', async () => {
    const password = 'OwnerPassword123!';
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: emails.owner,
        password,
        fullName: 'Throttle Owner',
        phone: '081' + String(Math.floor(Math.random() * 90_000_000) + 10_000_000),
        termsAccepted: true,
        termsVersion: 'e2e',
      })
      .expect(201);
    const code = MockMailProvider.lastCodeFor(emails.owner);
    if (!code) throw new Error('No verification code captured');
    await request(app.getHttpServer()).post('/api/auth/verify-otp').send({ email: emails.owner, code }).expect(201);

    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: emails.owner, password: 'WrongPassword123!' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: emails.owner, password: 'WrongPassword123!' })
      .expect(429);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: emails.owner, password })
      .expect(201);
  });

  it('locks the admin surface after five failed logins', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer())
        .post('/api/admin/login')
        .send({ email: emails.admin, password: 'WrongPassword123!' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/admin/login')
      .send({ email: emails.admin, password: 'WrongPassword123!' })
      .expect(429);
  });

  it('stops OTP guessing for one address', async () => {
    let limited = false;
    for (let i = 0; i < 25 && !limited; i += 1) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ email: emails.otp, code: '000000' });
      if (res.status === 429) limited = true;
      else expect(res.status).toBe(401);
    }
    expect(limited).toBe(true);
  });

  it('rate-limits password reset requests with a cooldown', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: emails.reset })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: emails.reset })
      .expect(429);
  });
});
