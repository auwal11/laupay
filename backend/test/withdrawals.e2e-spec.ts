import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { MockMailProvider } from '../src/common/mail/mock-mail.provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { CreditsService } from '../src/modules/credits/credits.service';
import { LedgerService } from '../src/modules/ledger/ledger.service';
import { WithdrawalsService } from '../src/modules/withdrawals/withdrawals.service';

process.env.WITHDRAWAL_BANKS_JSON = JSON.stringify([{ code: '058', name: 'GTBank' }]);

async function registerVerified(
  server: App,
  prisma: PrismaService,
  email: string,
): Promise<{ accessToken: string; userId: string }> {
  await request(server)
    .post('/api/auth/register')
    .send({
      email,
      password: 'Password123!',
      fullName: 'Withdrawal Tester',
      phone: '080' + String(Math.floor(Math.random() * 90_000_000) + 10_000_000),
      termsAccepted: true,
      termsVersion: 'e2e',
    })
    .expect(201);
  const code = MockMailProvider.lastCodeFor(email);
  if (!code) throw new Error('No verification code captured for ' + email);
  const res = await request(server).post('/api/auth/verify-otp').send({ email, code }).expect(201);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { accessToken: res.body.accessToken, userId: user.id };
}

describe('Withdrawals (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let withdrawals: WithdrawalsService;
  let session: { accessToken: string; userId: string };
  const base = {
    bankName: 'GTBank',
    accountName: 'Withdrawal Tester',
    accountNumber: '0123456789',
    pin: '1234',
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = moduleRef.get(PrismaService);
    withdrawals = moduleRef.get(WithdrawalsService);
    session = await registerVerified(app.getHttpServer(), prisma, `wd-${Date.now()}@test.local`);

    await request(app.getHttpServer())
      .post('/api/security/pin')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ pin: '1234' })
      .expect(201);
    const wallet = await prisma.walletAccount.findUniqueOrThrow({ where: { ownerId: session.userId } });
    await moduleRef.get(LedgerService).credit({
      walletAccountId: wallet.id,
      amount: '5000',
      reason: 'ADMIN_ADJUSTMENT' as never,
      source: 'e2e_funding',
      mode: 'test',
      idempotencyKey: `test-withdrawal-funding:${session.userId}`,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  async function balance() {
    const wallet = await prisma.walletAccount.findUniqueOrThrow({ where: { ownerId: session.userId } });
    return Number(wallet.balance);
  }

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/api/withdrawals').expect(401);
  });

  it('rejects a wrong PIN without moving money', async () => {
    const before = await balance();
    await request(app.getHttpServer())
      .post('/api/withdrawals')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ ...base, amount: 500, pin: '9999', idempotencyKey: `wd-bad-pin-${Date.now()}` })
      .expect(403);
    expect(await balance()).toBe(before);
  });

  it('accepts a request, holds the amount and shows it as pending', async () => {
    const before = await balance();
    const key = `wd-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/api/withdrawals')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ ...base, amount: 1500.5, idempotencyKey: key })
      .expect(201);

    expect(res.body.status).toBe('PENDING');
    expect(res.body.amount).toBe('1500.50');
    expect(res.body.reference).toMatch(/^WD-/);
    expect(await balance()).toBe(before - 1500.5);

    const transactions = await request(app.getHttpServer())
      .get('/api/wallet/transactions')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    const row = transactions.body.find((entry: { referenceId?: string }) => entry.referenceId === res.body.id);
    expect(row).toBeTruthy();
    expect(row.description).toBe('Withdrawal to GTBank');
    expect(row.status).toBe('pending');

    const retry = await request(app.getHttpServer())
      .post('/api/withdrawals')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ ...base, amount: 1500.5, idempotencyKey: key })
      .expect(201);
    expect(retry.body.id).toBe(res.body.id);
    expect(await balance()).toBe(before - 1500.5);
  });

  it('refuses more than the available balance', async () => {
    await request(app.getHttpServer())
      .post('/api/withdrawals')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ ...base, amount: 500_000, idempotencyKey: `wd-overspend-${Date.now()}` })
      .expect(400);
  });

  it('refunds the held amount when ops rejects the request', async () => {
    const before = await balance();
    const res = await request(app.getHttpServer())
      .post('/api/withdrawals')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ ...base, amount: 200, idempotencyKey: `wd-reject-${Date.now()}` })
      .expect(201);
    expect(await balance()).toBe(before - 200);

    const rejected = await withdrawals.reject('admin-test', res.body.id, 'Test rejection');
    expect(rejected.status).toBe('REJECTED');
    expect(await balance()).toBe(before);
  });

  it('marks a request paid without moving money twice', async () => {
    const before = await balance();
    const res = await request(app.getHttpServer())
      .post('/api/withdrawals')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ ...base, amount: 300, idempotencyKey: `wd-approve-${Date.now()}` })
      .expect(201);
    const approved = await withdrawals.approve('admin-test', res.body.id, 'Verified payout');
    expect(approved.status).toBe('APPROVED');
    expect(await balance()).toBe(before - 300);
  });
  it('refuses to withdraw test credits', async () => {
    const other = await registerVerified(app.getHttpServer(), prisma, `wd-test-credit-${Date.now()}@test.local`);
    await request(app.getHttpServer())
      .post('/api/security/pin')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ pin: '1234' })
      .expect(201);
    await app.get(CreditsService).grantTestCredit(other.userId, 1000, {
      idempotencyKey: `test-withdrawal-credit-only:${other.userId}`,
    });
    const before = await prisma.walletAccount.findUniqueOrThrow({ where: { ownerId: other.userId } });
    await request(app.getHttpServer())
      .post('/api/withdrawals')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ ...base, amount: 500, idempotencyKey: `wd-test-credit-${Date.now()}` })
      .expect(400);
    const after = await prisma.walletAccount.findUniqueOrThrow({ where: { ownerId: other.userId } });
    expect(after.balance.toString()).toBe(before.balance.toString());
  });
});
