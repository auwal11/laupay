import { Test, TestingModule } from '@nestjs/testing';
import { LedgerReason, WalletOwnerType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from './ledger.service';

/**
 * Runs LedgerService itself (not a re-implementation) against a real
 * PostgreSQL database under real concurrency. This is what actually proves
 * the row-level locking in LedgerService.applyEntry() works — a mocked
 * PrismaService (see ledger.service.spec.ts) cannot prove this, since there
 * is no real lock contention to race against.
 *
 * Requires a running Postgres reachable via DATABASE_URL and a generated
 * Prisma Client (`npx prisma generate && npx prisma migrate dev`) — this
 * could not be executed inside the sandboxed build environment used to
 * scaffold this project (no route to binaries.prisma.sh — see
 * docs/decisions/00-project-status.md). It is written to run wherever the
 * project has normal internet access (a developer machine or CI).
 *
 * The equivalent scenario was verified directly against raw SQL in
 * test/ledger-concurrency-proof.js and passed — see that file's output
 * captured in docs/decisions/00-project-status.md.
 */
describe('LedgerService (e2e, real Postgres)', () => {
  let service: LedgerService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LedgerService, PrismaService],
    }).compile();

    service = module.get(LedgerService);
    prisma = module.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createTestWallet(initialBalance: number) {
    const owner = await prisma.user.create({
      data: {
        email: `e2e-${Date.now()}-${Math.random()}@test.local`,
        passwordHash: 'unused-in-this-test',
        fullName: 'E2E Test User',
      },
    });
    const wallet = await prisma.walletAccount.create({
      data: { ownerId: owner.id, ownerType: WalletOwnerType.USER, balance: initialBalance },
    });
    return wallet;
  }

  it('never allows balance to go negative under 50 concurrent debits against a 1000 balance', async () => {
    const wallet = await createTestWallet(1000);

    const results = await Promise.allSettled(
      Array.from({ length: 50 }, (_, i) =>
        service.debit({
          walletAccountId: wallet.id,
          amount: 100,
          reason: LedgerReason.ORDER_PAYMENT,
          idempotencyKey: `e2e-concurrent-${wallet.id}-${i}`,
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const final = await prisma.walletAccount.findUniqueOrThrow({ where: { id: wallet.id } });

    expect(succeeded).toBe(10); // exactly 1000 / 100
    expect(Number(final.balance)).toBe(0);
    expect(Number(final.balance)).toBeGreaterThanOrEqual(0);

    const entryCount = await prisma.ledgerEntry.count({ where: { walletAccountId: wallet.id } });
    expect(entryCount).toBe(succeeded);
  });

  it('applies a debit exactly once when the same idempotency key is submitted 20 times concurrently', async () => {
    const wallet = await createTestWallet(1000);
    const key = `e2e-idempotent-${wallet.id}`;

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        service.debit({
          walletAccountId: wallet.id,
          amount: 100,
          reason: LedgerReason.ORDER_PAYMENT,
          idempotencyKey: key,
        }),
      ),
    );

    const final = await prisma.walletAccount.findUniqueOrThrow({ where: { id: wallet.id } });
    expect(Number(final.balance)).toBe(900);

    const entryCount = await prisma.ledgerEntry.count({ where: { walletAccountId: wallet.id } });
    expect(entryCount).toBe(1);

    // At least one call should report wasAlreadyApplied: true (all but the winner)
    expect(results.some((r) => r.wasAlreadyApplied)).toBe(true);
  });
});
