import { Injectable, Logger } from '@nestjs/common';
import { LedgerDirection, LedgerReason, Prisma, WalletStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InsufficientBalanceError,
  InsufficientWithdrawableBalanceError,
  InvalidAmountError,
  WalletNotActiveError,
} from './ledger.errors';
import { calculateWithdrawableBalance } from './withdrawal-provenance';

export interface LedgerEntryRequest {
  walletAccountId: string;
  amount: number | string;
  reason: LedgerReason;
  referenceType?: string;
  referenceId?: string;
  /** Human-readable statement line, e.g. "Test credit — Ibrahim Lau Provision Shop". */
  narrative?: string;
  /** Machine source, e.g. "test_allocation", "order_payment". */
  source?: string;
  /** Execution mode: test | simulated | live. */
  mode?: string;
  /** Admin who initiated the entry, when admin-driven. */
  adminId?: string;
  /**
   * MUST be unique per logical business event. Retrying the same request
   * with the same key is always safe — it returns the original result
   * instead of applying the mutation twice. See
   * docs/architecture/wallet-ledger-model.md §3.
   */
  idempotencyKey: string;
}

export interface LedgerEntryResult {
  entryId: string;
  walletAccountId: string;
  direction: LedgerDirection;
  amount: string;
  balanceAfter: string;
  /** true if this call returned a previously-applied entry rather than creating a new one */
  wasAlreadyApplied: boolean;
}

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/**
 * LedgerService is the ONLY code path in the entire system permitted to
 * change a WalletAccount's balance. Every mutation:
 *  1. Runs inside a database transaction.
 *  2. Takes a row-level lock on the wallet (SELECT ... FOR UPDATE) before
 *     reading its balance, so concurrent requests against the same wallet
 *     are serialized rather than racing.
 *  3. Re-validates the operation (sufficient balance, wallet active) using
 *     the value just read under the lock — never a value read earlier.
 *  4. Is idempotent: a duplicate idempotencyKey returns the original result
 *     instead of mutating the balance a second time.
 *
 * See docs/architecture/wallet-ledger-model.md for the full rationale.
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async credit(req: LedgerEntryRequest): Promise<LedgerEntryResult> {
    return this.applyEntry({ ...req, direction: LedgerDirection.CREDIT });
  }

  async debit(req: LedgerEntryRequest): Promise<LedgerEntryResult> {
    return this.applyEntry({ ...req, direction: LedgerDirection.DEBIT });
  }

  /**
   * Debits an eligible withdrawal hold only when real-credit capacity remains.
   * The provenance check shares the wallet row lock and transaction with the
   * ledger mutation, so concurrent withdrawal requests cannot reuse capacity.
   */
  async debitWithdrawal(req: LedgerEntryRequest): Promise<LedgerEntryResult> {
    return this.applyEntry({
      ...req,
      direction: LedgerDirection.DEBIT,
      enforceWithdrawableBalance: true,
    });
  }

  /**
   * Reverses a previous ledger entry by inserting a new, opposite-direction
   * entry. The original entry is never modified or deleted — see
   * docs/architecture/wallet-ledger-model.md §6.
   */
  async reverse(originalEntryId: string, idempotencyKey: string): Promise<LedgerEntryResult> {
    const original = await this.prisma.ledgerEntry.findUniqueOrThrow({
      where: { id: originalEntryId },
    });
    const oppositeDirection =
      original.direction === LedgerDirection.CREDIT
        ? LedgerDirection.DEBIT
        : LedgerDirection.CREDIT;

    return this.applyEntry({
      walletAccountId: original.walletAccountId,
      amount: original.amount.toString(),
      reason: LedgerReason.REVERSAL,
      referenceType: 'LedgerEntry',
      referenceId: original.id,
      idempotencyKey,
      direction: oppositeDirection,
    });
  }

  private async applyEntry(
    req: LedgerEntryRequest & {
      direction: LedgerDirection;
      enforceWithdrawableBalance?: boolean;
    },
  ): Promise<LedgerEntryResult> {
    const amount = new Prisma.Decimal(req.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new InvalidAmountError(req.amount);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Row-level lock on the wallet — blocks concurrent mutations to
        //    the same wallet until this transaction commits/rolls back.
        const rows = await tx.$queryRaw<
          { id: string; balance: Prisma.Decimal; status: WalletStatus; version: number }[]
        >(Prisma.sql`
          SELECT "id", "balance", "status", "version"
          FROM "WalletAccount"
          WHERE "id" = ${req.walletAccountId}
          FOR UPDATE
        `);

        const wallet = rows[0];
        if (!wallet) {
          throw new Error(`WalletAccount not found: ${req.walletAccountId}`);
        }
        if (wallet.status !== WalletStatus.ACTIVE) {
          throw new WalletNotActiveError(wallet.id, wallet.status);
        }

        if (req.enforceWithdrawableBalance) {
          const existing = await tx.ledgerEntry.findUnique({
            where: { idempotencyKey: req.idempotencyKey },
          });
          if (existing) {
            return {
              entryId: existing.id,
              walletAccountId: existing.walletAccountId,
              direction: existing.direction,
              amount: existing.amount.toString(),
              balanceAfter: existing.balanceAfter.toString(),
              wasAlreadyApplied: true,
            };
          }

          const entries = await tx.ledgerEntry.findMany({
            where: { walletAccountId: wallet.id },
            select: { direction: true, amount: true, source: true, mode: true, reason: true },
          });
          const withdrawable = calculateWithdrawableBalance(entries);
          if (withdrawable.lessThan(amount)) {
            throw new InsufficientWithdrawableBalanceError(wallet.id);
          }
        }

        const balanceAfter =
          req.direction === LedgerDirection.CREDIT
            ? wallet.balance.add(amount)
            : wallet.balance.sub(amount);

        if (req.direction === LedgerDirection.DEBIT && balanceAfter.lessThan(0)) {
          throw new InsufficientBalanceError(wallet.id);
        }

        // 2. Insert the ledger entry. The idempotencyKey unique constraint
        //    is the real enforcement — if this insert conflicts, we catch it
        //    below and return the original result instead of retrying.
        const entry = await tx.ledgerEntry.create({
          data: {
            walletAccountId: wallet.id,
            direction: req.direction,
            amount,
            balanceAfter,
            reason: req.reason,
            narrative: req.narrative,
            source: req.source,
            mode: req.mode,
            adminId: req.adminId,
            referenceType: req.referenceType,
            referenceId: req.referenceId,
            idempotencyKey: req.idempotencyKey,
          },
        });

        // 3. Update the cached balance in the SAME transaction as the
        //    ledger insert — this is what keeps balance == SUM(ledger) true
        //    by construction.
        await tx.walletAccount.update({
          where: { id: wallet.id },
          data: { balance: balanceAfter, version: { increment: 1 } },
        });

        return {
          entryId: entry.id,
          walletAccountId: wallet.id,
          direction: entry.direction,
          amount: entry.amount.toString(),
          balanceAfter: entry.balanceAfter.toString(),
          wasAlreadyApplied: false,
        };
      });
    } catch (err) {
      if (this.isUniqueConstraintViolation(err, 'idempotencyKey')) {
        // Duplicate request (retry, double-tap, replayed webhook) — the
        // mutation was already applied. Return the original result rather
        // than applying it again.
        this.logger.debug(
          `Idempotent replay detected for key=${req.idempotencyKey}, returning original result`,
        );
        const existing = await this.prisma.ledgerEntry.findUniqueOrThrow({
          where: { idempotencyKey: req.idempotencyKey },
        });
        return {
          entryId: existing.id,
          walletAccountId: existing.walletAccountId,
          direction: existing.direction,
          amount: existing.amount.toString(),
          balanceAfter: existing.balanceAfter.toString(),
          wasAlreadyApplied: true,
        };
      }
      throw err;
    }
  }

  private isUniqueConstraintViolation(err: unknown, target?: string): boolean {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === UNIQUE_CONSTRAINT_VIOLATION
    ) {
      if (!target) return true;
      const meta = (err as { meta?: { target?: string[] | string } }).meta;
      if (!meta?.target) return true;
      return Array.isArray(meta.target) ? meta.target.includes(target) : meta.target === target;
    }
    return false;
  }
}
