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
 * Covers ADR 0002's "Pricing: Configurable, Never Hardcoded" section and
 * the confirmAgentCash security fix (client-supplied `amount` removed —
 * the agent debit is now always computed server-side from the Order and
 * Network/DataPlan pricing configuration).
 */
describe('Agent pricing & confirm-cash security (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let agentToken: string;
  let agentUserId: string;
  let customerToken: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    prisma = moduleRef.get(PrismaService);

    const agent = { email: `agent-pricing-${Date.now()}@test.local`, password: 'Password123!', fullName: 'Agent Pricing' };
        agentToken = await registerVerified(app.getHttpServer(), agent);
    const agentUser = await prisma.user.findUniqueOrThrow({ where: { email: agent.email } });
    agentUserId = agentUser.id;
    // No self-service way to become an AGENT (by design — see
    // docs/decisions/0004-customer-web-integration-audit.md §3.1). Promote
    // directly here the same way a real admin action would.
    await prisma.user.update({ where: { id: agentUserId }, data: { role: 'AGENT' } });
    // JWTs encode the role at issuance time, so the registration token still
    // says CUSTOMER. Log in again to get a token that reflects the promotion.
    const agentLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: agent.email, password: agent.password });
    agentToken = agentLogin.body.accessToken;
    // Give the agent float enough balance for these tests.
    const agentWallet = await prisma.walletAccount.findUniqueOrThrow({ where: { ownerId: agentUserId } });
    await prisma.walletAccount.update({ where: { id: agentWallet.id }, data: { balance: 100000 } });

    const customer = { email: `customer-pricing-${Date.now()}@test.local`, password: 'Password123!', fullName: 'Customer Pricing' };
        customerToken = await registerVerified(app.getHttpServer(), customer);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUnpaidAirtimeOrderRecord(network: string, amount: number) {
    // Insert an order directly (bypassing the normal customer-pays flow)
    // to isolate what confirmAgentCash does, independent of the wallet
    // debit that would otherwise happen in createAirtimeOrder.
    const customerUser = await prisma.user.findFirstOrThrow({
      where: { email: { contains: 'customer-pricing' } },
    });
    return prisma.order.create({
      data: {
        userId: customerUser.id,
        type: 'AIRTIME',
        status: 'CREATED',
        network,
        phoneNumber: '08077770000',
        amount,
        idempotencyKey: `agent-pricing-order-${Date.now()}-${Math.random()}`,
      },
    });
  }

  it('debits the agent at face value when no discount is configured (default, unchanged behavior)', async () => {
    await prisma.network.upsert({
      where: { code: 'MTN' },
      update: { agentDiscountPercent: 0 },
      create: { code: 'MTN', name: 'MTN', agentDiscountPercent: 0 },
    });
    const order = await createUnpaidAirtimeOrderRecord('MTN', 1000);

    const balanceBefore = Number(
      (await prisma.walletAccount.findUniqueOrThrow({ where: { ownerId: agentUserId } })).balance,
    );

    await request(app.getHttpServer())
      .post('/api/payments/confirm-cash')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ orderId: order.id })
      .expect(201);

    const balanceAfter = Number(
      (await prisma.walletAccount.findUniqueOrThrow({ where: { ownerId: agentUserId } })).balance,
    );
    expect(balanceBefore - balanceAfter).toBe(1000);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { idempotencyKey: `agent-cash:${order.id}` } });
    expect(Number(payment.amount)).toBe(1000); // Payment records the customer-facing face value
  });

  it('debits the agent at the configured discounted rate for a network with agentDiscountPercent set', async () => {
    await prisma.network.upsert({
      where: { code: 'AIRTEL' },
      update: { agentDiscountPercent: 5 }, // 5% agent discount, configured via the database, not hardcoded in app code
      create: { code: 'AIRTEL', name: 'AIRTEL', agentDiscountPercent: 5 },
    });
    const order = await createUnpaidAirtimeOrderRecord('AIRTEL', 1000);

    const balanceBefore = Number(
      (await prisma.walletAccount.findUniqueOrThrow({ where: { ownerId: agentUserId } })).balance,
    );

    await request(app.getHttpServer())
      .post('/api/payments/confirm-cash')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ orderId: order.id })
      .expect(201);

    const balanceAfter = Number(
      (await prisma.walletAccount.findUniqueOrThrow({ where: { ownerId: agentUserId } })).balance,
    );
    // 1000 * (1 - 5/100) = 950 — the agent keeps 50 as margin, the Payment
    // record still shows the customer paid the full 1000 face value.
    expect(balanceBefore - balanceAfter).toBe(950);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { idempotencyKey: `agent-cash:${order.id}` } });
    expect(Number(payment.amount)).toBe(1000);
  });

  it('SECURITY: a client-supplied amount field on confirm-cash is rejected outright (400), not silently ignored', async () => {
    const order = await createUnpaidAirtimeOrderRecord('MTN', 500);

    const res = await request(app.getHttpServer())
      .post('/api/payments/confirm-cash')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ orderId: order.id, amount: 1 }); // trying to debit only ₦1 instead of the real ₦500

    expect(res.status).toBe(400); // ConfirmCashDto no longer declares `amount` — forbidNonWhitelisted rejects it

    // Confirm the order can still be settled correctly afterward, at the
    // real server-computed amount, once the bogus field is removed.
    const balanceBefore = Number(
      (await prisma.walletAccount.findUniqueOrThrow({ where: { ownerId: agentUserId } })).balance,
    );
    await request(app.getHttpServer())
      .post('/api/payments/confirm-cash')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ orderId: order.id })
      .expect(201);
    const balanceAfter = Number(
      (await prisma.walletAccount.findUniqueOrThrow({ where: { ownerId: agentUserId } })).balance,
    );
    expect(balanceBefore - balanceAfter).toBe(500); // full real amount, never the injected ₦1
  });

  it('a CUSTOMER (not an AGENT) still cannot call confirm-cash at all, regardless of the DTO change', async () => {
    const order = await createUnpaidAirtimeOrderRecord('MTN', 200);
    await request(app.getHttpServer())
      .post('/api/payments/confirm-cash')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderId: order.id })
      .expect(403);
  });
});
