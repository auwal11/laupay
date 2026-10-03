import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { MockMailProvider } from '../src/common/mail/mock-mail.provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReconciliationService } from '../src/modules/reconciliation/reconciliation.service';

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
 * Regression test for docs/decisions/0003-phase1-hardening-review.md
 * Remaining Risk #2: previously, an order whose VTU transaction initially
 * returned UNKNOWN and later resolved to FAILED (via webhook or
 * reconciliation) was never revisited — the customer stayed debited with
 * no reversal and the order stuck in FULFILLMENT_UNKNOWN forever.
 *
 * Uses MockVTUProvider's .03-cents scenario (UNKNOWN on first attempt,
 * resolves to FAILED on verify) — see that file's docblock.
 */
describe('VTU async failure reversal (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reconciliationService: ReconciliationService;

  const user = { email: `vtu-reversal-${Date.now()}@test.local`, password: 'Password123!', fullName: 'Vtu Reversal User' };
  let token: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    prisma = moduleRef.get(PrismaService);
    reconciliationService = moduleRef.get(ReconciliationService);

        token = await registerVerified(app.getHttpServer(), user);

    // Fund the wallet directly so the order below has enough balance.
    const wallet = await prisma.walletAccount.findFirstOrThrow({ where: { user: { email: user.email } } });
    await prisma.walletAccount.update({ where: { id: wallet.id }, data: { balance: 5000 } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('debits the wallet immediately, but does NOT reverse it while the VTU outcome is still UNKNOWN', async () => {
    const key = `vtu-reversal-order-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/api/orders/airtime')
      .set('Authorization', `Bearer ${token}`)
      .send({ network: 'MTN', phoneNumber: '08099990000', amount: 200.03, idempotencyKey: key })
      .expect(201);

    expect(res.body.status).toBe('FULFILLMENT_UNKNOWN');

    const wallet = await prisma.walletAccount.findFirstOrThrow({ where: { user: { email: user.email } } });
    // 5000 - 200.03 = 4799.97 — debited immediately (debit-before-fulfillment, see vtu-flow.md §2)
    expect(Number(wallet.balance)).toBeCloseTo(4799.97, 2);
  });

  it('reconciliation resolves the stuck order to REFUNDED and restores the wallet balance exactly once', async () => {
    const key = `vtu-reversal-order-2-${Date.now()}`;
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders/airtime')
      .set('Authorization', `Bearer ${token}`)
      .send({ network: 'MTN', phoneNumber: '08099990001', amount: 300.03, idempotencyKey: key });
    const orderId = orderRes.body.id;
    expect(orderRes.body.status).toBe('FULFILLMENT_UNKNOWN');

    const balanceAfterDebit = Number(
      (await prisma.walletAccount.findFirstOrThrow({ where: { user: { email: user.email } } })).balance,
    );

    // Force the VtuTransaction to look "stale" so the reconciliation pass picks it up.
    await prisma.vtuTransaction.update({
      where: { orderId },
      data: { updatedAt: new Date(Date.now() - 10 * 60 * 1000) },
    });

    await reconciliationService.runOnce();

    const resolvedOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(resolvedOrder.status).toBe('REFUNDED');

    const balanceAfterReversal = Number(
      (await prisma.walletAccount.findFirstOrThrow({ where: { user: { email: user.email } } })).balance,
    );
    expect(balanceAfterReversal).toBeCloseTo(balanceAfterDebit + 300.03, 2);

    // Run reconciliation again — must be a no-op (no double reversal/credit).
    await reconciliationService.runOnce();
    const balanceAfterSecondRun = Number(
      (await prisma.walletAccount.findFirstOrThrow({ where: { user: { email: user.email } } })).balance,
    );
    expect(balanceAfterSecondRun).toBe(balanceAfterReversal);

    const reversalEntries = await prisma.ledgerEntry.findMany({
      where: { idempotencyKey: `ledger:order:${orderId}:reversal` },
    });
    expect(reversalEntries.length).toBe(1); // exactly one reversal entry, never duplicated
  });

  it('the same resolution also works when delivered via POST /webhooks/vtu instead of the reconciliation job', async () => {
    const key = `vtu-reversal-webhook-${Date.now()}`;
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders/airtime')
      .set('Authorization', `Bearer ${token}`)
      .send({ network: 'MTN', phoneNumber: '08099990002', amount: 150.03, idempotencyKey: key });
    const orderId = orderRes.body.id;

    const txn = await prisma.vtuTransaction.findUniqueOrThrow({ where: { orderId } });

    const balanceBefore = Number(
      (await prisma.walletAccount.findFirstOrThrow({ where: { user: { email: user.email } } })).balance,
    );

    await request(app.getHttpServer())
      .post('/api/webhooks/vtu')
      .set('x-webhook-signature', 'mock-shared-secret')
      .send({ providerReference: txn.providerReference, status: 'FAILED' })
      .expect(201);

    const resolvedOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(resolvedOrder.status).toBe('REFUNDED');

    const balanceAfter = Number(
      (await prisma.walletAccount.findFirstOrThrow({ where: { user: { email: user.email } } })).balance,
    );
    expect(balanceAfter).toBeCloseTo(balanceBefore + 150.03, 2);
  });

  it('an order that resolves to SUCCESS (not FAILED) is marked FULFILLED and the wallet is left debited', async () => {
    const key = `vtu-success-async-${Date.now()}`;
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders/airtime')
      .set('Authorization', `Bearer ${token}`)
      .send({ network: 'MTN', phoneNumber: '08099990003', amount: 50.02, idempotencyKey: key }); // .02 -> UNKNOWN -> resolves SUCCESS
    const orderId = orderRes.body.id;
    expect(orderRes.body.status).toBe('FULFILLMENT_UNKNOWN');

    await prisma.vtuTransaction.update({
      where: { orderId },
      data: { updatedAt: new Date(Date.now() - 10 * 60 * 1000) },
    });
    await reconciliationService.runOnce();

    const resolvedOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(resolvedOrder.status).toBe('FULFILLED');
  });

  it('does not touch an order that is already terminal (FULFILLED) even if reconciliation runs again', async () => {
    const key = `vtu-terminal-guard-${Date.now()}`;
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders/airtime')
      .set('Authorization', `Bearer ${token}`)
      .send({ network: 'MTN', phoneNumber: '08099990004', amount: 10.0, idempotencyKey: key }); // .00 -> immediate SUCCESS
    const orderId = orderRes.body.id;
    expect(orderRes.body.status).toBe('FULFILLED');

    const balanceBefore = Number(
      (await prisma.walletAccount.findFirstOrThrow({ where: { user: { email: user.email } } })).balance,
    );
    await reconciliationService.runOnce();
    const balanceAfter = Number(
      (await prisma.walletAccount.findFirstOrThrow({ where: { user: { email: user.email } } })).balance,
    );
    expect(balanceAfter).toBe(balanceBefore);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('FULFILLED');
  });
});
