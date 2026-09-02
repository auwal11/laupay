import { Test, TestingModule } from '@nestjs/testing';
import { LedgerDirection, LedgerReason, WalletStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from './ledger.service';
import { InsufficientBalanceError, WalletNotActiveError } from './ledger.errors';

/**
 * These tests exercise LedgerService against a mocked PrismaService so they
 * run without a live database — useful for fast local iteration. The
 * behaviors verified here (idempotency, insufficient-balance rejection,
 * inactive-wallet rejection) are also covered end-to-end against a real
 * Postgres instance in test/wallet.e2e-spec.ts, which is what actually
 * proves the row-level locking works under real concurrency — a mock
 * cannot prove that.
 */
describe('LedgerService', () => {
  let service: LedgerService;
  let prisma: {
    $transaction: jest.Mock;
    ledgerEntry: { findUniqueOrThrow: jest.Mock };
  };

  const WALLET_ID = 'wallet-1';

  function makeTxMock(wallet: {
    id: string;
    balance: any;
    status: WalletStatus;
    version: number;
  }) {
    const created: any[] = [];
    return {
      $queryRaw: jest.fn().mockResolvedValue([wallet]),
      ledgerEntry: {
        create: jest.fn().mockImplementation(({ data }: any) => {
          const entry = { id: `entry-${created.length + 1}`, ...data };
          created.push(entry);
          return Promise.resolve(entry);
        }),
      },
      walletAccount: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
  }

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      ledgerEntry: { findUniqueOrThrow: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [LedgerService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(LedgerService);
  });

  it('credits a wallet and increases balanceAfter correctly', async () => {
    const wallet = { id: WALLET_ID, balance: bignum(1000), status: WalletStatus.ACTIVE, version: 0 };
    const tx = makeTxMock(wallet);
    prisma.$transaction.mockImplementation((fn: any) => fn(tx));

    const result = await service.credit({
      walletAccountId: WALLET_ID,
      amount: 500,
      reason: LedgerReason.WALLET_FUNDING,
      idempotencyKey: 'credit-1',
    });

    expect(result.direction).toBe(LedgerDirection.CREDIT);
    expect(result.balanceAfter).toBe('1500');
    expect(result.wasAlreadyApplied).toBe(false);
    expect(tx.walletAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: WALLET_ID } }),
    );
  });

  it('debits a wallet when balance is sufficient', async () => {
    const wallet = { id: WALLET_ID, balance: bignum(1000), status: WalletStatus.ACTIVE, version: 0 };
    const tx = makeTxMock(wallet);
    prisma.$transaction.mockImplementation((fn: any) => fn(tx));

    const result = await service.debit({
      walletAccountId: WALLET_ID,
      amount: 400,
      reason: LedgerReason.ORDER_PAYMENT,
      idempotencyKey: 'debit-1',
    });

    expect(result.balanceAfter).toBe('600');
  });

  it('rejects a debit that would push the balance negative', async () => {
    const wallet = { id: WALLET_ID, balance: bignum(100), status: WalletStatus.ACTIVE, version: 0 };
    const tx = makeTxMock(wallet);
    prisma.$transaction.mockImplementation((fn: any) => fn(tx));

    await expect(
      service.debit({
        walletAccountId: WALLET_ID,
        amount: 200,
        reason: LedgerReason.ORDER_PAYMENT,
        idempotencyKey: 'debit-2',
      }),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });

  it('rejects any mutation on a non-ACTIVE wallet', async () => {
    const wallet = { id: WALLET_ID, balance: bignum(1000), status: WalletStatus.FROZEN, version: 0 };
    const tx = makeTxMock(wallet);
    prisma.$transaction.mockImplementation((fn: any) => fn(tx));

    await expect(
      service.credit({
        walletAccountId: WALLET_ID,
        amount: 100,
        reason: LedgerReason.WALLET_FUNDING,
        idempotencyKey: 'credit-frozen',
      }),
    ).rejects.toBeInstanceOf(WalletNotActiveError);
  });

  it('rejects a zero or negative amount before touching the database', async () => {
    await expect(
      service.credit({
        walletAccountId: WALLET_ID,
        amount: 0,
        reason: LedgerReason.WALLET_FUNDING,
        idempotencyKey: 'credit-zero',
      }),
    ).rejects.toThrow('Ledger amount must be a positive number');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns the original result on a duplicate idempotency key instead of mutating twice', async () => {
    prisma.$transaction.mockImplementation(async () => {
      const err: any = new Error('Unique constraint failed');
      err.code = 'P2002';
      err.meta = { target: ['idempotencyKey'] };
      throw err;
    });
    prisma.ledgerEntry.findUniqueOrThrow.mockResolvedValue({
      id: 'entry-original',
      walletAccountId: WALLET_ID,
      direction: LedgerDirection.CREDIT,
      amount: bignum(500),
      balanceAfter: bignum(1500),
    });

    const result = await service.credit({
      walletAccountId: WALLET_ID,
      amount: 500,
      reason: LedgerReason.WALLET_FUNDING,
      idempotencyKey: 'duplicate-key',
    });

    expect(result.wasAlreadyApplied).toBe(true);
    expect(result.entryId).toBe('entry-original');
    expect(result.balanceAfter).toBe('1500');
  });
});

/** Minimal Decimal-like stand-in so tests don't need a real Prisma.Decimal import path issue. */
function bignum(n: number) {
  return {
    add: (other: any) => bignum(n + Number(other.toString())),
    sub: (other: any) => bignum(n - Number(other.toString())),
    lessThan: (other: number) => n < other,
    lessThanOrEqualTo: (other: number) => n <= other,
    toString: () => String(n),
  };
}
