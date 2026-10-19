import { TransactionList } from "@app/components/wallet/TransactionList";

export function TransactionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-laupay-amber">LAUPAY wallet</p><h1 className="mt-1 font-display text-2xl font-semibold text-laupay-ink">Transaction History</h1><p className="mt-1 text-sm text-laupay-ink-muted">View, track and manage all your transactions.</p></div>
      <TransactionList />
    </div>
  );
}
