import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordHasher } from '../src/modules/auth/password-hasher.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Admin console (e2e): proves the control-panel routes are wired to the real
 * guards, that sensitive mutations require a written reason, and that wallet
 * adjustments are ledger-backed and reversible.
 */
describe('Admin console (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let customerId: string;
  let walletId: string;

  const stamp = Date.now();
  const adminEmail = `ops-admin-${stamp}@test.local`;
  const customerEmail = `ops-customer-${stamp}@test.local`;
  const password = 'Password123!';

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    prisma = moduleRef.get(PrismaService);
    const hasher = moduleRef.get(PasswordHasher);
    const passwordHash = await hasher.hash(password);

    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        fullName: 'Ops Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });

    const customer = await prisma.user.create({
      data: {
        email: customerEmail,
        passwordHash,
        fullName: 'Ops Customer',
        phone: `081${String(stamp).slice(-8)}`,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });
    customerId = customer.id;
    const wallet = await prisma.walletAccount.create({
      data: { ownerId: customer.id, ownerType: 'USER' },
    });
    walletId = wallet.id;

    const login = await request(app.getHttpServer())
      .post('/api/admin/login')
      .send({ email: adminEmail, password });
    expect([200, 201]).toContain(login.status);
    token = login.body.accessToken as string;
    expect(token).toBeTruthy();
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actor: { email: adminEmail } } });
    await prisma.adminNote.deleteMany({ where: { userId: customerId } });
    await prisma.riskEvent.deleteMany({ where: { userId: customerId } });
    await prisma.ledgerEntry.deleteMany({ where: { walletAccountId: walletId } });
    await prisma.walletAccount.deleteMany({ where: { id: walletId } });
    const users = await prisma.user.findMany({
      where: { email: { in: [adminEmail, customerEmail] } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.emailOtp.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.systemSetting.deleteMany({
      where: { key: { in: ['service_data_enabled', 'provider_fulfillment_mode'] } },
    });
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('returns the admin identity with a permission set', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/me').set(auth()).expect(200);
    expect(res.body.role).toBe('ADMIN');
    expect(Array.isArray(res.body.permissions)).toBe(true);
    expect(res.body.permissions).toContain('wallets.adjust');
  });

  it('exposes provider health and the attention queue on the overview', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/overview').set(auth()).expect(200);
    expect(res.body.providerHealth).toBeDefined();
    expect(res.body.providerHealth.vtu.provider).toBeTruthy();
    expect(res.body.attention).toEqual(
      expect.objectContaining({
        pendingPayments: expect.any(Number),
        stuckOrders: expect.any(Number),
        openDisputes: expect.any(Number),
      }),
    );
  });

  it('stores a kill switch and surfaces it in the settings snapshot', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/settings/kill-switch')
      .set(auth())
      .send({ key: 'service_data_enabled', paused: true, reason: 'E2E: pause data purchases' })
      .expect(201);

    const res = await request(app.getHttpServer()).get('/api/admin/settings').set(auth()).expect(200);
    expect(res.body.settings.service_data_enabled).toBe('false');

    await request(app.getHttpServer())
      .post('/api/admin/settings/kill-switch')
      .set(auth())
      .send({ key: 'service_data_enabled', paused: false, reason: 'E2E: resume data purchases' })
      .expect(201);
  });

  it('rejects a sensitive action without a reason', async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/users/${customerId}/freeze`)
      .set(auth())
      .send({ reason: '' })
      .expect(400);
  });

  it('freezes and unfreezes an account with an audited reason', async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/users/${customerId}/freeze`)
      .set(auth())
      .send({ reason: 'E2E: suspected account takeover' })
      .expect(201);

    const frozen = await prisma.user.findUniqueOrThrow({ where: { id: customerId } });
    expect(frozen.status).toBe('FROZEN');

    await request(app.getHttpServer())
      .post(`/api/admin/users/${customerId}/unfreeze`)
      .set(auth())
      .send({ reason: 'E2E: identity confirmed by phone' })
      .expect(201);

    const active = await prisma.user.findUniqueOrThrow({ where: { id: customerId } });
    expect(active.status).toBe('ACTIVE');

    const audit = await prisma.auditLog.findFirst({
      where: { actor: { email: adminEmail }, reason: 'E2E: suspected account takeover' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.before).toBeTruthy();
    expect(audit?.after).toBeTruthy();
  });

  it('credits a wallet through the ledger and reverses it, restoring the balance', async () => {
    const credit = await request(app.getHttpServer())
      .post('/api/admin/wallets/credit')
      .set(auth())
      .send({
        userId: customerId,
        amount: 2500,
        reason: 'E2E: goodwill credit',
        idempotencyKey: `e2e-credit-${stamp}`,
      })
      .expect(201);

    expect(credit.body.balanceAfter).toBe('2500');
    const entryId = credit.body.entryId as string;

    const reversed = await request(app.getHttpServer())
      .post(`/api/admin/ledger/${entryId}/reverse`)
      .set(auth())
      .send({ reason: 'E2E: credited in error' })
      .expect(201);

    const wallet = await prisma.walletAccount.findUniqueOrThrow({ where: { id: walletId } });
    expect(wallet.balance.toString()).toBe('0');
    expect(reversed.body).toBeDefined();
  });

  it('rejects switching to an invalid provider mode', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/settings/provider-mode')
      .set(auth())
      .send({ mode: 'live-ish', reason: 'E2E: invalid mode check' })
      .expect(400);
  });

  it('forbids a customer token from reaching admin routes', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: customerEmail, password });
    const customerToken = login.body.accessToken as string;
    await request(app.getHttpServer())
      .get('/api/admin/overview')
      .set({ Authorization: `Bearer ${customerToken}` })
      .expect(403);
  });
});
