import { LedgerDirection, LedgerReason, Prisma } from '@prisma/client';
import { calculateWithdrawableBalance, WithdrawalLedgerRow } from './withdrawal-provenance';

function entry(
  direction: LedgerDirection,
  amount: string,
  reason: LedgerReason,
  source: string | null,
  mode: string | null,
): WithdrawalLedgerRow {
  return { direction, amount: new Prisma.Decimal(amount), reason, source, mode };
}

describe('calculateWithdrawableBalance', () => {
  it('does not reuse test-credit offset against an existing withdrawal hold', () => {
    const available = calculateWithdrawableBalance([
      entry(LedgerDirection.CREDIT, '1000', LedgerReason.ADMIN_ADJUSTMENT, 'test_allocation', 'test'),
      entry(LedgerDirection.CREDIT, '1000', LedgerReason.WALLET_FUNDING, 'payment_provider', 'live'),
      entry(LedgerDirection.DEBIT, '1000', LedgerReason.WITHDRAWAL, 'withdrawal_request', 'test'),
    ]);

    expect(available.toFixed(2)).toBe('0.00');
  });

  it('continues to apply test credits first to ordinary spending', () => {
    const available = calculateWithdrawableBalance([
      entry(LedgerDirection.CREDIT, '1000', LedgerReason.ADMIN_ADJUSTMENT, 'test_allocation', 'test'),
      entry(LedgerDirection.CREDIT, '1000', LedgerReason.WALLET_FUNDING, 'payment_provider', 'live'),
      entry(LedgerDirection.DEBIT, '500', LedgerReason.ORDER_PAYMENT, 'order_payment', 'test'),
    ]);

    expect(available.toFixed(2)).toBe('1000.00');
  });

  it('subtracts ordinary spending beyond test credits from real-credit capacity', () => {
    const available = calculateWithdrawableBalance([
      entry(LedgerDirection.CREDIT, '1000', LedgerReason.ADMIN_ADJUSTMENT, 'test_allocation', 'test'),
      entry(LedgerDirection.CREDIT, '1000', LedgerReason.WALLET_FUNDING, 'payment_provider', 'live'),
      entry(LedgerDirection.DEBIT, '1500', LedgerReason.ORDER_PAYMENT, 'order_payment', 'live'),
    ]);

    expect(available.toFixed(2)).toBe('500.00');
  });

  it('treats a withdrawal refund as restoration of real withdrawal capacity', () => {
    const available = calculateWithdrawableBalance([
      entry(LedgerDirection.CREDIT, '1000', LedgerReason.ADMIN_ADJUSTMENT, 'test_allocation', 'test'),
      entry(LedgerDirection.CREDIT, '1000', LedgerReason.WALLET_FUNDING, 'payment_provider', 'live'),
      entry(LedgerDirection.DEBIT, '1000', LedgerReason.WITHDRAWAL, 'withdrawal_request', 'test'),
      entry(LedgerDirection.CREDIT, '1000', LedgerReason.REVERSAL, 'withdrawal_refund', 'test'),
    ]);

    expect(available.toFixed(2)).toBe('1000.00');
  });
});
