import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { MockMailProvider } from '../src/common/mail/mock-mail.provider';

class TestAuthHelper {
  /**
   * Registers and completes email verification, returning a usable access
   * token. Mirrors the staging flow (requirements 3 + 4) so no test can
   * bypass verification to obtain a session.
   */
  static async registerVerified(
    server: App,
    user: { email: string; password: string; fullName: string; phone?: string },
  ): Promise<string> {
    await request(server).post('/api/auth/register').send(user).expect(201);

    // MAIL_PROVIDER=mock captures the code in-process (MockMailProvider.sent).
    const code = MockMailProvider.lastCodeFor(user.email);
    if (!code) throw new Error('No verification code captured for ' + user.email);

    const res = await request(server)
      .post('/api/auth/verify-otp')
      .send({ email: user.email, code })
      .expect(201);
    return res.body.accessToken as string;
  }
}

describe('Registration → Email OTP → Login (e2e)', () => {
  let app: INestApplication;
  // `phone` is @unique, so it must be unique per run — a fixed literal makes
  // a second run of this suite fail with a 500 unique-constraint error.
  const runId = Date.now().toString().slice(-9);
  const phone = (suffix: string) => `0803${runId}${suffix}`;
  const user = {
    email: `otp-flow-${runId}@test.local`,
    password: 'Password123!',
    fullName: 'OTP Flow User',
    phone: phone('1'),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registration issues NO tokens and leaves the account unverified', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(user)
      .expect(201);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.requiresVerification).toBe(true);
  });

  it('login is refused until the email is verified (requirement 3)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(401);
  });

  it('a wrong OTP code is rejected', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/verify-otp')
      .send({ email: user.email, code: '000000' })
      .expect(401);
  });

  it('the correct OTP activates the account and returns tokens', async () => {
    const token = await TestAuthHelper.registerVerified(app.getHttpServer(), {
      ...user,
      email: `otp-verify-${Date.now()}@test.local`,
      phone: phone('9'),
    });
    expect(typeof token).toBe('string');
  });

  it('login succeeds after verification (requirement 4)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(201);
  });

  it('a new user starts with a balance of exactly 0.00 (requirement 5)', async () => {
    const token = await TestAuthHelper.registerVerified(app.getHttpServer(), {
      ...user,
      email: `otp-balance-${Date.now()}@test.local`,
      phone: phone('2'),
    });
    const res = await request(app.getHttpServer())
      .get('/api/wallet')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Number(res.body.balance)).toBe(0);
  });

  it('rejects a malformed (non-6-digit) code at the DTO layer', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/verify-otp')
      .send({ email: user.email, code: '12345' })
      .expect(400);
  });
});