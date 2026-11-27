import { Injectable, Logger, Optional } from '@nestjs/common';
import { LedgerDirection, LedgerReason, Prisma, WalletStatus, WithdrawalStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InsufficientBalanceError,
  InsufficientWithdrawableBalanceError,
  InvalidAmountError,
  WalletNotActiveError,
} from './ledger.errors';
import { calculateWithdrawableBalance } from './withdrawal-provenance';
import { AppConfigService } from '../../config/app-config.service';
import { persistTransactionAlert, TransactionAlertType } from '../notifications/transaction-alerts';

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

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: AppConfigService,
  ) {}

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
  async reverse(
    originalEntryId: string,
    idempotencyKey: string,
    details: { adminId?: string; narrative?: string } = {},
  ): Promise<LedgerEntryResult> {
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
      narrative: details.narrative ?? `Reversal of transaction ${original.id}`,
      source: original.referenceType === 'Order' ? 'order_reversal' : 'ledger_reversal',
      mode: original.mode ?? 'live',
      adminId: details.adminId,
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
          { id: string; ownerId: string; ownerType: string; currency: string; balance: Prisma.Decimal; status: WalletStatus; version: number }[]
        >(Prisma.sql`
          SELECT "id", "ownerId", "ownerType", "currency", "balance", "status", "version"
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

        await this.persistLedgerAlert(tx, entry, wallet, req, balanceAfter);

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

  private async persistLedgerAlert(
    tx: Prisma.TransactionClient,
    entry: {
      id: string;
      amount: Prisma.Decimal;
      createdAt: Date;
      direction: LedgerDirection;
      referenceType: string | null;
      referenceId: string | null;
      adminId: string | null;
    },
    wallet: { ownerId: string; ownerType: string; currency: string; balance: Prisma.Decimal },
    req: LedgerEntryRequest & { direction: LedgerDirection; enforceWithdrawableBalance?: boolean },
    balanceAfter: Prisma.Decimal,
  ): Promise<void> {
    if ((wallet.ownerType !== 'USER' && wallet.ownerType !== 'AGENT') || req.reason === LedgerReason.ORDER_PAYMENT || req.source === 'order_reversal') return;
    if (req.mode && req.mode !== 'live') return;
    if (req.source?.startsWith('test') || req.source === 'admin_test_credit') return;

    let alertType: TransactionAlertType;
    if (req.reason === LedgerReason.REVERSAL) alertType = 'REVERSAL';
    else if (req.reason === LedgerReason.ORDER_REFUND) alertType = 'REFUND';
    else alertType = req.direction === LedgerDirection.CREDIT ? 'CREDIT' : 'DEBIT';

    let originalEntry: { id: string; referenceId: string | null } | null = null;
    if (alertType === 'REVERSAL' && req.referenceType === 'LedgerEntry' && req.referenceId) {
      originalEntry = await tx.ledgerEntry.findUnique({
        where: { id: req.referenceId },
        select: { id: true, referenceId: true },
      });
    } else if (alertType === 'REVERSAL' && req.referenceType === 'Withdrawal' && req.referenceId) {
      originalEntry = await tx.ledgerEntry.findFirst({
        where: { referenceType: 'Withdrawal', referenceId: req.referenceId, direction: LedgerDirection.DEBIT },
        select: { id: true, referenceId: true },
      });
    } else if (alertType === 'REFUND' && req.referenceType === 'TransactionDispute' && req.referenceId) {
      const dispute = await tx.transactionDispute.findUnique({
        where: { id: req.referenceId },
        select: { ledgerEntry: { select: { id: true, referenceId: true } } },
      });
      originalEntry = dispute?.ledgerEntry ?? null;
    }
    const withdrawal = req.referenceType === 'Withdrawal' && req.referenceId
      ? await tx.withdrawal.findUnique({ where: { id: req.referenceId }, select: { id: true, reference: true, status: true } })
      : null;

    const amount = entry.amount.toFixed(2);
    const currency = wallet.currency || 'NGN';
    const narrative = req.narrative?.trim() || req.reason.replaceAll('_', ' ');
    const isWithdrawalRequest = req.reason === LedgerReason.WITHDRAWAL && withdrawal;
    const isWithdrawalRefund = req.reason === LedgerReason.REVERSAL && withdrawal;
    const transactionReference = isWithdrawalRefund
      ? `${withdrawal.reference}-RF`
      : withdrawal?.reference ?? entry.referenceId ?? entry.id;
    const transactionStatus = isWithdrawalRefund ? WithdrawalStatus.REFUNDED : withdrawal?.status ?? 'POSTED';
    const title = isWithdrawalRequest
      ? 'Withdrawal request received'
      : isWithdrawalRefund
        ? 'Withdrawal funds refunded'
        : alertType === 'REVERSAL'
      ? 'Transaction reversed'
      : alertType === 'REFUND'
        ? 'Refund received'
        : alertType === 'CREDIT'
          ? 'Wallet credited'
          : 'Wallet debited';
    const body = isWithdrawalRequest
      ? `${currency} ${amount} is held pending review for withdrawal ${transactionReference}.`
      : isWithdrawalRefund
        ? `${currency} ${amount} has been returned to your wallet for withdrawal ${transactionReference}.`
        : alertType === 'REVERSAL'
      ? `${currency} ${amount} was posted as a reversal linked to the original transaction.`
      : alertType === 'REFUND'
        ? `${currency} ${amount} was refunded to your wallet.`
        : `${currency} ${amount} was ${req.direction === LedgerDirection.CREDIT ? 'credited to' : 'debited from'} your wallet.`;
    const date = entry.createdAt.toISOString();
    const metadata = {
      alertType,
      transactionId: entry.id,
      transactionReference,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      amount,
      currency,
      narrative,
      status: transactionStatus,
      date,
      balanceBefore: wallet.balance.toFixed(2),
      availableBalance: balanceAfter.toFixed(2),
      adminId: entry.adminId,
      originalTransactionId: originalEntry?.id,
      originalReference: withdrawal?.reference ?? originalEntry?.referenceId ?? originalEntry?.id,
      reversalReference: isWithdrawalRefund ? transactionReference : undefined,
      orderId: entry.referenceType === 'Order' ? entry.referenceId : undefined,
      withdrawalId: withdrawal?.id,
      withdrawalReference: withdrawal?.reference,
    };

    await persistTransactionAlert(tx, {
      eventKey: `ledger:${entry.id}`,
      userId: wallet.ownerId,
      title,
      body,
      category: 'wallet',
      metadata,
      email: {
        alertType,
        title,
        body,
        amount,
        currency,
        transactionReference,
        status: transactionStatus,
        date,
        narrative,
        balanceBefore: wallet.balance.toFixed(2),
        availableBalance: balanceAfter.toFixed(2),
        originalReference: withdrawal?.reference ?? originalEntry?.referenceId ?? originalEntry?.id ?? undefined,
        originalTransactionId: originalEntry?.id,
        supportEmail: this.config?.supportEmail ?? process.env.SUPPORT_EMAIL ?? 'support.laupay@gmail.com',
      },
    });
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
