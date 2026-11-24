import { Test, TestingModule } from '@nestjs/testing';
import { LedgerDirection, LedgerReason, Prisma, WalletStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from './ledger.service';
import {
  InsufficientBalanceError,
  InsufficientWithdrawableBalanceError,
  WalletNotActiveError,
} from './ledger.errors';

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
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
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

  it('checks real-credit capacity under the wallet lock and does not offset an existing hold with test credits', async () => {
    const wallet = { id: WALLET_ID, balance: bignum(1000), status: WalletStatus.ACTIVE, version: 1 };
    const tx = makeTxMock(wallet);
    tx.ledgerEntry.findMany.mockResolvedValue([
      {
        direction: LedgerDirection.CREDIT,
        amount: new Prisma.Decimal('1000'),
        source: 'test_allocation',
        mode: 'test',
        reason: LedgerReason.ADMIN_ADJUSTMENT,
      },
      {
        direction: LedgerDirection.CREDIT,
        amount: new Prisma.Decimal('1000'),
        source: 'e2e_funding',
        mode: 'test',
        reason: LedgerReason.WALLET_FUNDING,
      },
      {
        direction: LedgerDirection.DEBIT,
        amount: new Prisma.Decimal('1000'),
        source: 'withdrawal_request',
        mode: 'test',
        reason: LedgerReason.WITHDRAWAL,
      },
    ]);
    prisma.$transaction.mockImplementation((fn: any) => fn(tx));

    await expect(
      service.debitWithdrawal({
        walletAccountId: WALLET_ID,
        amount: '500',
        reason: LedgerReason.WITHDRAWAL,
        idempotencyKey: 'withdrawal-insufficient-real-capacity',
      }),
    ).rejects.toBeInstanceOf(InsufficientWithdrawableBalanceError);

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.ledgerEntry.findMany).toHaveBeenCalled();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.ledgerEntry.findMany.mock.invocationCallOrder[0],
    );
    expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
    expect(tx.walletAccount.update).not.toHaveBeenCalled();
  });

  it('returns an already-applied withdrawal idempotently before checking remaining capacity', async () => {
    const wallet = { id: WALLET_ID, balance: bignum(0), status: WalletStatus.ACTIVE, version: 1 };
    const tx = makeTxMock(wallet);
    tx.ledgerEntry.findUnique.mockResolvedValue({
      id: 'withdrawal-entry-original',
      walletAccountId: WALLET_ID,
      direction: LedgerDirection.DEBIT,
      amount: new Prisma.Decimal('1000'),
      balanceAfter: new Prisma.Decimal('0'),
    });
    prisma.$transaction.mockImplementation((fn: any) => fn(tx));

    const result = await service.debitWithdrawal({
      walletAccountId: WALLET_ID,
      amount: '1000',
      reason: LedgerReason.WITHDRAWAL,
      idempotencyKey: 'withdrawal-idempotent-replay',
    });

    expect(result.wasAlreadyApplied).toBe(true);
    expect(result.entryId).toBe('withdrawal-entry-original');
    expect(tx.ledgerEntry.findMany).not.toHaveBeenCalled();
    expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
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
