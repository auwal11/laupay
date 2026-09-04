import { TransactionList } from "@/components/wallet/TransactionList";

export function TransactionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-xl font-semibold text-laupay-ink">Transactions</h1>
      <TransactionList />
    </div>
  );
}
