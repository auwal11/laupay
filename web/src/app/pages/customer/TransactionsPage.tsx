import { TransactionList } from "@app/components/wallet/TransactionList";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export function TransactionsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Link to="/app" className="inline-flex w-fit items-center gap-2 text-sm font-medium text-laupay-ink-muted hover:text-laupay-indigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-laupay-indigo"><ArrowLeft size={16} /> Back to dashboard</Link>
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-laupay-amber">LAUPAY wallet</p><h1 className="mt-1 font-display text-2xl font-semibold text-laupay-ink">Transaction History</h1><p className="mt-1 text-sm text-laupay-ink-muted">View and track your payments.</p></div>
      <TransactionList />
    </div>
  );
}
