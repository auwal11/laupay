import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Covers the minimum PIN backend added to unblock apps/customer-web's
 * security pages — see docs/decisions/0004-customer-web-integration-audit.md
 * §3.3. Also confirms the placeholder risk-decision shape now present on
 * order-creation responses.
 */
describe('Security PIN (e2e)', () => {
  let app: INestApplication;

  const user = { email: `pin-${Date.now()}@test.local`, password: 'Password123!', fullName: 'Pin Test User' };
  let token: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    const res = await request(app.getHttpServer()).post('/api/auth/register').send(user);
    token = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports no PIN set for a brand new user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/security/pin/status')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual({ hasPin: false, locked: false, lockedUntil: null });
  });

  it('rejects a non-numeric or wrong-length PIN at the DTO layer', async () => {
    await request(app.getHttpServer())
      .post('/api/security/pin')
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: 'abcd' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/security/pin')
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: '123' })
      .expect(400);
  });

  it('sets a PIN, then rejects setting a second one (must use change instead)', async () => {
    await request(app.getHttpServer())
      .post('/api/security/pin')
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: '1234' })
      .expect(201);

    const status = await request(app.getHttpServer())
      .get('/api/security/pin/status')
      .set('Authorization', `Bearer ${token}`);
    expect(status.body.hasPin).toBe(true);

    await request(app.getHttpServer())
      .post('/api/security/pin')
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: '5678' })
      .expect(409);
  });

  it('verifies a correct PIN and rejects an incorrect one', async () => {
    await request(app.getHttpServer())
      .post('/api/security/pin/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: '1234' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/security/pin/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: '0000' })
      .expect(401);
  });

  it('locks the PIN after 5 consecutive failed attempts, even with the correct PIN afterward', async () => {
    const lockUser = { email: `pin-lock-${Date.now()}@test.local`, password: 'Password123!', fullName: 'Lock Test' };
    const lockRes = await request(app.getHttpServer()).post('/api/auth/register').send(lockUser);
    const lockToken = lockRes.body.accessToken;

    await request(app.getHttpServer())
      .post('/api/security/pin')
      .set('Authorization', `Bearer ${lockToken}`)
      .send({ pin: '9999' })
      .expect(201);

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/security/pin/verify')
        .set('Authorization', `Bearer ${lockToken}`)
        .send({ pin: '0000' })
        .expect(401);
    }

    // 6th attempt — even with the CORRECT pin — must be rejected as locked.
    await request(app.getHttpServer())
      .post('/api/security/pin/verify')
      .set('Authorization', `Bearer ${lockToken}`)
      .send({ pin: '9999' })
      .expect(403);

    const status = await request(app.getHttpServer())
      .get('/api/security/pin/status')
      .set('Authorization', `Bearer ${lockToken}`);
    expect(status.body.locked).toBe(true);
  });

  it('changes the PIN given the correct current PIN, and the old PIN stops working', async () => {
    await request(app.getHttpServer())
      .post('/api/security/pin/change')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPin: '1234', newPin: '4321' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/security/pin/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: '4321' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/security/pin/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: '1234' })
      .expect(401);
  });

  it('rejects changing the PIN with an incorrect current PIN', async () => {
    const otherUser = { email: `pin-change-fail-${Date.now()}@test.local`, password: 'Password123!', fullName: 'Change Fail' };
    const otherRes = await request(app.getHttpServer()).post('/api/auth/register').send(otherUser);
    const otherToken = otherRes.body.accessToken;

    await request(app.getHttpServer())
      .post('/api/security/pin')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ pin: '1111' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/security/pin/change')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ currentPin: '9999', newPin: '2222' })
      .expect(401);
  });

  it('requires authentication for every PIN endpoint', async () => {
    await request(app.getHttpServer()).get('/api/security/pin/status').expect(401);
    await request(app.getHttpServer()).post('/api/security/pin').send({ pin: '1234' }).expect(401);
  });
});

describe('Order risk-decision placeholder shape (e2e)', () => {
  let app: INestApplication;
  const user = { email: `risk-shape-${Date.now()}@test.local`, password: 'Password123!', fullName: 'Risk Shape User' };
  let token: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    const res = await request(app.getHttpServer()).post('/api/auth/register').send(user);
    token = res.body.accessToken;

    const prisma = moduleRef.get(require('../src/prisma/prisma.service').PrismaService);
    const wallet = await prisma.walletAccount.findFirstOrThrow({ where: { user: { email: user.email } } });
    await prisma.walletAccount.update({ where: { id: wallet.id }, data: { balance: 1000 } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('includes a riskDecision field (currently always "allow" — placeholder, not a real risk engine) on order creation', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/orders/airtime')
      .set('Authorization', `Bearer ${token}`)
      .send({ network: 'MTN', phoneNumber: '08088880000', amount: 100, idempotencyKey: `risk-shape-${Date.now()}` })
      .expect(201);

    expect(res.body.riskDecision).toBe('allow');
  });
});
