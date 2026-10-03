import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { MockMailProvider } from '../src/common/mail/mock-mail.provider';
import { PrismaService } from '../src/prisma/prisma.service';

/** Registers + verifies via the real OTP flow (requirements 3 + 4). */
async function registerVerified(
  server: App,
  user: { email: string; password: string; fullName: string; phone?: string },
): Promise<string> {
  await request(server).post('/api/auth/register').send(user).expect(201);
  const code = MockMailProvider.lastCodeFor(user.email);
  if (!code) throw new Error('No verification code captured for ' + user.email);
  const res = await request(server)
    .post('/api/auth/verify-otp')
    .send({ email: user.email, code })
    .expect(201);
  return res.body.accessToken as string;
}

/**
 * Security-focused e2e suite. Boots the full Nest application (real HTTP
 * layer, real guards, real DB via PrismaService) and attacks it the way a
 * malicious or careless client would, rather than unit-testing guards in
 * isolation. This is what proves the guards are actually wired onto the
 * right routes, not just that they work correctly if applied.
 *
 * See docs/security/security-model.md and
 * docs/decisions/00-project-status.md §4 (financial integrity checklist)
 * for what this suite is meant to close the gap on.
 */
describe('Security (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const userA = { email: `sec-a-${Date.now()}@test.local`, password: 'Password123!', fullName: 'User A' };
  const userB = { email: `sec-b-${Date.now()}@test.local`, password: 'Password123!', fullName: 'User B' };
  let tokenA: string;
  let tokenB: string;
  let orderIdOwnedByA: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    prisma = moduleRef.get(PrismaService);

        tokenA = await registerVerified(app.getHttpServer(), userA);

        tokenB = await registerVerified(app.getHttpServer(), userB);

    // Fund User A's wallet directly via Prisma so we can place a paid order
    // without depending on the payments flow in this test file.
    const walletA = await prisma.walletAccount.findFirstOrThrow({
      where: { user: { email: userA.email } },
    });
    await prisma.walletAccount.update({
      where: { id: walletA.id },
      data: { balance: 10_000 },
    });

    const orderRes = await request(app.getHttpServer())
      .post('/api/orders/airtime')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        network: 'MTN',
        phoneNumber: '08010000000',
        amount: 100, // .00 -> mock provider SUCCESS path
        idempotencyKey: `sec-test-order-${Date.now()}`,
      });
    orderIdOwnedByA = orderRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication is required', () => {
    it('rejects GET /api/wallet with no Authorization header', async () => {
      await request(app.getHttpServer()).get('/api/wallet').expect(401);
    });

    it('rejects GET /api/orders with an invalid/garbage token', async () => {
      await request(app.getHttpServer())
        .get('/api/orders')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });

    it('rejects GET /api/admin/dashboard entirely unauthenticated', async () => {
      await request(app.getHttpServer()).get('/api/admin/dashboard').expect(401);
    });
  });

  describe('IDOR / BOLA — object-level ownership', () => {
    it('lets the owner read their own order', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/orders/${orderIdOwnedByA}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(res.body.id).toBe(orderIdOwnedByA);
    });

    it('forbids a DIFFERENT authenticated user from reading someone else\'s order by ID', async () => {
      await request(app.getHttpServer())
        .get(`/api/orders/${orderIdOwnedByA}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(403);
    });

    it('returns 404 (not 500/leaked-info) for a well-formed but nonexistent order ID', async () => {
      await request(app.getHttpServer())
        .get('/api/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });
  });

  describe('Role-based authorization', () => {
    it('forbids a CUSTOMER from calling the AGENT-only /payments/confirm-cash', async () => {
      await request(app.getHttpServer())
        .post('/api/payments/confirm-cash')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ orderId: orderIdOwnedByA, amount: 100 })
        .expect(403);
    });

    it('forbids a non-ADMIN user from reading /admin/dashboard', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(403);
    });

    it('forbids a non-ADMIN user from triggering /admin/reconciliation/run', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/reconciliation/run')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(403);
    });
  });

  describe('Client-supplied field tampering is rejected', () => {
    it('rejects a register payload that tries to smuggle a role field', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `sec-tamper-${Date.now()}@test.local`,
          password: 'Password123!',
          fullName: 'Tamper Test',
          role: 'ADMIN', // not a declared field on RegisterDto — must be rejected outright
        });
      expect(res.status).toBe(400);
    });

    it('rejects an order-creation payload that tries to smuggle a status field', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/orders/airtime')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          network: 'MTN',
          phoneNumber: '08010000001',
          amount: 100,
          idempotencyKey: `sec-tamper-order-${Date.now()}`,
          status: 'FULFILLED', // not a declared field — must be rejected, never silently dropped-and-succeeded
        });
      expect(res.status).toBe(400);
    });

    it('rejects a negative or zero order amount', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/orders/airtime')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          network: 'MTN',
          phoneNumber: '08010000002',
          amount: -500,
          idempotencyKey: `sec-negative-${Date.now()}`,
        });
      expect(res.status).toBe(400);
    });
  });

  describe('Idempotency at the HTTP layer', () => {
    it('returns the same order for a repeated idempotencyKey instead of creating a duplicate', async () => {
      const key = `sec-idempotent-http-${Date.now()}`;
      const first = await request(app.getHttpServer())
        .post('/api/orders/airtime')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ network: 'MTN', phoneNumber: '08010000003', amount: 100, idempotencyKey: key });

      const second = await request(app.getHttpServer())
        .post('/api/orders/airtime')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ network: 'MTN', phoneNumber: '08010000003', amount: 100, idempotencyKey: key });

      expect(first.body.id).toBe(second.body.id);

      const count = await prisma.order.count({ where: { idempotencyKey: key } });
      expect(count).toBe(1);
    });
  });
});
