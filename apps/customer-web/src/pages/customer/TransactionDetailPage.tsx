import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatDateTime, formatNaira } from "@/lib/format";
import { wallet } from "@/services";
import type { AsyncState } from "@/types/common";
import type { TransactionDetail } from "@/types/wallet";

export function TransactionDetailPage() {
  const { id = "" } = useParams();
  const [state, setState] = useState<AsyncState<TransactionDetail>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    wallet.getTransaction(id).then((result) => {
      if (cancelled) return;
      setState(result.ok ? { status: "success", data: result.data } : { status: "error", error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.status === "loading") {
    return <Skeleton className="h-64 w-full max-w-md" />;
  }

  if (state.status === "error") {
    return <ErrorState error={state.error} />;
  }

  if (state.status !== "success") return null;

  const txn = state.data;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="font-display text-xl font-semibold text-laupay-ink">Transaction details</h1>
      <Card>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-laupay-ink">{txn.description}</p>
          <StatusBadge status={txn.status} />
        </div>
        <p className="mt-3 font-display text-2xl font-semibold text-laupay-ink">
          {formatNaira(txn.amount)}
        </p>

        <dl className="mt-5 flex flex-col gap-2.5 text-sm">
          <Row label="Reference" value={txn.reference} />
          {txn.providerReference && <Row label="Provider reference" value={txn.providerReference} />}
          {txn.network && <Row label="Network" value={txn.network} />}
          {txn.counterparty && <Row label="Recipient" value={txn.counterparty} />}
          <Row label="Date" value={formatDateTime(txn.createdAt)} />
        </dl>

        {txn.status === "failed" && txn.failureReason && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-laupay-danger">
            {txn.failureReason}
          </p>
        )}

        <Link
          to={`/app/receipt/${txn.id}`}
          className="mt-5 inline-block text-sm font-medium text-laupay-indigo hover:underline"
        >
          View receipt
        </Link>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-laupay-ink-muted">{label}</dt>
      <dd className="font-medium text-laupay-ink">{value}</dd>
    </div>
  );
}
