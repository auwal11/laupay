import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { MockMailProvider } from '../src/common/mail/mock-mail.provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { PaymentsService } from '../src/modules/payments/payments.service';

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
      fullName: 'Virtual Account User',
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

describe('Virtual account deposits (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let payments: PaymentsService;
  let session: { accessToken: string; userId: string };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = moduleRef.get(PrismaService);
    payments = moduleRef.get(PaymentsService);
    session = await registerVerified(app.getHttpServer(), prisma, `va-${Date.now()}@test.local`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns no account before one is created', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/payments/virtual-account')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(res.body.account).toBeNull();
  });

  it('fails safely when Monnify is not configured, without creating a row', async () => {
    await request(app.getHttpServer())
      .post('/api/payments/virtual-account')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({})
      .expect(503);
    const count = await prisma.virtualAccount.count({ where: { userId: session.userId } });
    expect(count).toBe(0);
  });

  it('rejects a malformed BVN before calling the provider', async () => {
    await request(app.getHttpServer())
      .post('/api/payments/virtual-account')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ bvn: '123' })
      .expect(400);
  });

  it('credits a reserved-account deposit exactly once on retries', async () => {
    const reference = `MONNIFY-E2E-${Date.now()}`;
    const input = {
      userId: session.userId,
      amount: 1500.5,
      transactionReference: reference,
      accountReference: 'LAUPAY_TEST',
    };

    const first = await payments.creditReservedAccountDeposit(input);
    const second = await payments.creditReservedAccountDeposit(input);

    expect(first.status).toBe('credited');
    expect(second.status).toBe('ignored_duplicate');

    const payment = await prisma.payment.findUniqueOrThrow({ where: { providerReference: reference } });
    expect(payment.status).toBe('SUCCESS');
    const entries = await prisma.ledgerEntry.count({ where: { referenceId: payment.id } });
    expect(entries).toBe(1);

    const wallet = await prisma.walletAccount.findFirstOrThrow({ where: { ownerId: session.userId } });
    expect(Number(wallet.balance)).toBeGreaterThanOrEqual(1500.5);
  });
});
