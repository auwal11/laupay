import { LedgerDirection, LedgerReason, Prisma } from '@prisma/client';

/** Minimal ledger projection needed to calculate withdrawal eligibility. */
export interface WithdrawalLedgerRow {
  direction: LedgerDirection;
  amount: Prisma.Decimal;
  source: string | null;
  mode: string | null;
  reason: LedgerReason;
}

export function isTestCredit(row: WithdrawalLedgerRow): boolean {
  return row.direction === LedgerDirection.CREDIT && (
    row.source === 'test_allocation' ||
    row.source === 'admin_test_credit' ||
    (row.mode === 'test' && row.reason === LedgerReason.ADMIN_ADJUSTMENT)
  );
}

/**
 * Computes the real-credit capacity available to secure withdrawal holds.
 *
 * Ordinary debits consume test credits first, as required by the wallet's
 * test-credit policy. Withdrawal holds are different: they must consume real
 * credit capacity, and must never be offset by the test-credit pool. Refunds
 * are credits, so they restore the corresponding wallet capacity.
 */
export function calculateWithdrawableBalance(rows: WithdrawalLedgerRow[]): Prisma.Decimal {
  let testCredits = new Prisma.Decimal(0);
  let realCredits = new Prisma.Decimal(0);
  let ordinaryDebits = new Prisma.Decimal(0);
  let withdrawalHolds = new Prisma.Decimal(0);

  for (const row of rows) {
    if (row.direction === LedgerDirection.CREDIT) {
      if (isTestCredit(row)) testCredits = testCredits.plus(row.amount);
      else realCredits = realCredits.plus(row.amount);
      continue;
    }

    if (row.reason === LedgerReason.WITHDRAWAL || row.source === 'withdrawal_request') {
      withdrawalHolds = withdrawalHolds.plus(row.amount);
    } else {
      ordinaryDebits = ordinaryDebits.plus(row.amount);
    }
  }

  const realConsumedByOrdinarySpending = Prisma.Decimal.max(
    ordinaryDebits.minus(testCredits),
    new Prisma.Decimal(0),
  );
  return Prisma.Decimal.max(
    realCredits.minus(realConsumedByOrdinarySpending).minus(withdrawalHolds),
    new Prisma.Decimal(0),
  );
}
