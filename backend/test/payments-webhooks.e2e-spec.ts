import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as bodyParser from 'body-parser';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { ReconciliationService } from '../src/modules/reconciliation/reconciliation.service';
import { MockMailProvider } from '../src/common/mail/mock-mail.provider';

/**
 * Registers + verifies via the real OTP flow (requirements 3 + 4) and returns
 * an access token. Tests must not obtain a session by skipping verification.
 */
export async function registerVerified(
  server: App,
  user: { email: string; password: string; fullName: string; phone?: string },
): Promise<string> {
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
  return res.body.accessToken as string;
}

async function waitFor<T>(
  fn: () => Promise<T | null | undefined>,
  timeoutMs = 5000,
): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value as T;
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 50));
  }
}

/**
 * Covers docs/architecture/payment-flow.md end to end:
 *   - webhook signature verification (§4)
 *   - webhook replay/duplicate-delivery protection (§4)
 *   - the PENDING -> PROCESSING -> SUCCESS/FAILED/UNKNOWN state machine (§1)
 *   - timeout/UNKNOWN never being silently treated as FAILED (§2)
 *   - reconciliation resolving a stuck UNKNOWN payment (§3)
 *
 * Relies on MockPaymentProvider's deterministic-by-cents simulation (see
 * that file's docblock): amount ending .00 -> SUCCESS, .01 -> FAILED,
 * .02 -> UNKNOWN then resolves to SUCCESS on requery.
 */
describe('Payments & Webhooks flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let paymentsService: PaymentsService;
  let reconciliationService: ReconciliationService;

  const user = { email: `pay-flow-${Date.now()}@test.local`, password: 'Password123!', fullName: 'Pay Flow User' };
  let token: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bodyParser: false });
    // Mirror main.ts: capture the raw request bytes so webhook signatures can
    // be verified over the exact payload the provider signed.
    app.use(
      bodyParser.json({
        verify: (req, _res, buf) => {
          (req as unknown as { rawBody?: Buffer }).rawBody = Buffer.from(buf);
        },
      }),
    );
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    prisma = moduleRef.get(PrismaService);
    paymentsService = moduleRef.get(PaymentsService);
    reconciliationService = moduleRef.get(ReconciliationService);

    token = await registerVerified(app.getHttpServer(), user);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('State machine — SUCCESS path', () => {
    it('funding with a .00 amount resolves straight to SUCCESS and credits the wallet', async () => {
      const key = `pay-success-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/api/payments/initialize')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 500.0, idempotencyKey: key })
        .expect(201);

      expect(res.body.status).toBe('SUCCESS');

      const wallet = await request(app.getHttpServer())
        .get('/api/wallet')
        .set('Authorization', `Bearer ${token}`);
      expect(Number(wallet.body.balance)).toBeGreaterThanOrEqual(500);
    });
  });

  describe('State machine — FAILED path', () => {
    it('funding with a .01 amount resolves to FAILED and does NOT credit the wallet', async () => {
      const key = `pay-failed-${Date.now()}`;
      const before = await request(app.getHttpServer())
        .get('/api/wallet')
        .set('Authorization', `Bearer ${token}`);

      const res = await request(app.getHttpServer())
        .post('/api/payments/initialize')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 200.01, idempotencyKey: key })
        .expect(201);

      expect(res.body.status).toBe('FAILED');

      const after = await request(app.getHttpServer())
        .get('/api/wallet')
        .set('Authorization', `Bearer ${token}`);
      expect(Number(after.body.balance)).toBe(Number(before.body.balance));
    });
  });

  describe('State machine — UNKNOWN (timeout) is never silently treated as FAILED', () => {
    it('a .02 amount resolves to UNKNOWN, not FAILED, and the wallet is not credited yet', async () => {
      const key = `pay-unknown-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/api/payments/initialize')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 300.02, idempotencyKey: key })
        .expect(201);

      expect(res.body.status).toBe('UNKNOWN');
      expect(res.body.status).not.toBe('FAILED'); // the specific regression this guards against
    });

    it('reconciliation resolves that UNKNOWN payment to SUCCESS and credits the wallet exactly once', async () => {
      const key = `pay-unknown-reconcile-${Date.now()}`;
      const initRes = await request(app.getHttpServer())
        .post('/api/payments/initialize')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 150.02, idempotencyKey: key });
      expect(initRes.body.status).toBe('UNKNOWN');

      const paymentId = initRes.body.id;

      // Force it to look "stale" so the reconciliation pass picks it up
      // (the job only requeries records older than its threshold).
      await prisma.payment.update({
        where: { id: paymentId },
        data: { updatedAt: new Date(Date.now() - 10 * 60 * 1000) },
      });

      await reconciliationService.runOnce();

      const resolved = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(resolved.status).toBe('SUCCESS');

      // Run reconciliation again — must NOT double-credit the wallet.
      const walletBefore = await prisma.walletAccount.findFirstOrThrow({
        where: { user: { email: user.email } },
      });
      await reconciliationService.runOnce();
      const walletAfter = await prisma.walletAccount.findFirstOrThrow({
        where: { user: { email: user.email } },
      });
      expect(Number(walletAfter.balance)).toBe(Number(walletBefore.balance));
    });
  });

  describe('Webhook signature verification', () => {
    it('rejects a webhook with no signature header', async () => {
      await request(app.getHttpServer())
        .post('/api/webhooks/payment')
        .send({ providerEventId: 'evt_1', providerReference: 'mock_fake', status: 'SUCCESS' })
        .expect(400);
    });

    it('rejects a webhook with an incorrect signature', async () => {
      await request(app.getHttpServer())
        .post('/api/webhooks/payment')
        .set('x-webhook-signature', 'wrong-secret')
        .send({ providerEventId: 'evt_2', providerReference: 'mock_fake', status: 'SUCCESS' })
        .expect(400);
    });

    it('rejects a correctly-signed webhook that references an unknown payment', async () => {
      await request(app.getHttpServer())
        .post('/api/webhooks/payment')
        .set('x-webhook-signature', 'mock-shared-secret')
        .send({ providerEventId: 'evt_3', providerReference: 'mock_does_not_exist', status: 'SUCCESS' })
        .expect(400);
    });
  });

  describe('Webhook replay / duplicate delivery protection', () => {
    it('processes a webhook once, then ignores an exact replay of the same event', async () => {
      const key = `pay-webhook-replay-${Date.now()}`;
      const initRes = await request(app.getHttpServer())
        .post('/api/payments/initialize')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 75.02, idempotencyKey: key }); // .02 -> UNKNOWN, providerReference exists
      const providerReference = (
        await prisma.payment.findUniqueOrThrow({ where: { id: initRes.body.id } })
      ).providerReference!;

      const webhookBody = {
        event: 'charge.success',
        data: { id: `evt_replay_${Date.now()}`, reference: providerReference },
      };

      const first = await request(app.getHttpServer())
        .post('/api/webhooks/payment')
        .set('x-webhook-signature', 'mock-shared-secret')
        .send(webhookBody);
      expect(first.body.status).toBe('accepted');

      // Exact same event delivered again (providers commonly retry webhooks).
      const replay = await request(app.getHttpServer())
        .post('/api/webhooks/payment')
        .set('x-webhook-signature', 'mock-shared-secret')
        .send(webhookBody);
      expect(replay.body.status).toBe('ignored_duplicate');

      const eventCount = await prisma.paymentEvent.count({
        where: { providerEventId: `charge.success:${webhookBody.data.id}` },
      });
      expect(eventCount).toBe(1);
    });
  });

  describe('Payment amount/status cannot be tampered with via the request body', () => {
    it('ignores a client-supplied status/amount on the webhook payload beyond the declared shape', async () => {
      // The webhook only reads providerEventId/providerReference/status —
      // proves there is no path where a client can, say, pass a `creditAmount`
      // field and have it override the payment's actual stored amount.
      const key = `pay-tamper-webhook-${Date.now()}`;
      const initRes = await request(app.getHttpServer())
        .post('/api/payments/initialize')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 10.02, idempotencyKey: key });
      const payment = await prisma.payment.findUniqueOrThrow({ where: { id: initRes.body.id } });

      await request(app.getHttpServer())
        .post('/api/webhooks/payment')
        .set('x-webhook-signature', 'mock-shared-secret')
        .send({
          event: 'charge.success',
          data: { id: `evt_tamper_${Date.now()}`, reference: payment.providerReference },
          amount: 999999, // not read by the handler at all — must have zero effect
        });

      // The handler requeries the provider asynchronously before crediting, so
      // poll for the ledger entry rather than assuming it exists synchronously.
      const walletEntry = await waitFor(() =>
        prisma.ledgerEntry.findFirst({
          where: { referenceType: 'Payment', referenceId: payment.id },
        }),
      );
      // The credited amount must match the ORIGINAL payment amount (10.02),
      // never the bogus amount injected in the webhook body.
      expect(Number(walletEntry.amount)).toBe(10.02);
    });
  });
});
