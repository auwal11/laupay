import { Link } from "react-router-dom";
import { StatusBadge } from "@app/components/ui/Badge";
import { Skeleton } from "@app/components/ui/Skeleton";
import { ErrorState } from "@app/components/ui/ErrorState";
import { EmptyState } from "@app/components/ui/EmptyState";
import { formatDateTime, formatNaira } from "@app/lib/format";
import { useTransactions } from "@app/hooks/useTransactions";

export function TransactionList({ limit }: { limit?: number }) {
  const state = useTransactions();

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState error={state.error} />;
  }

  if (state.status === "empty") {
    return (
      <EmptyState
        title="No transactions yet"
        description="Your airtime, data, and wallet activity will show up here once you make your first purchase."
      />
    );
  }

  if (state.status !== "success") return null;

  const rows = limit ? state.data.slice(0, limit) : state.data;

  return (
    <ul className="flex flex-col divide-y divide-laupay-border rounded-lg border border-laupay-border bg-white">
      {rows.map((txn) => (
        <li key={txn.id}>
          <Link
            to={`/app/transactions/${txn.id}`}
            className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-laupay-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-laupay-indigo"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-laupay-ink">{txn.description}</p>
              <p className="text-xs text-laupay-ink-muted">{formatDateTime(txn.createdAt)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-semibold tabular-nums text-laupay-ink">
                {formatNaira(txn.amount)}
              </span>
              <StatusBadge status={txn.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
