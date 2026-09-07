import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "@app/components/ui/Card";
import { StatusBadge } from "@app/components/ui/Badge";
import { Button } from "@app/components/ui/Button";
import { Skeleton } from "@app/components/ui/Skeleton";
import { ErrorState } from "@app/components/ui/ErrorState";
import { formatDateTime, formatNaira } from "@app/lib/format";
import { wallet } from "@app/services";
import type { AsyncState } from "@app/types/common";
import type { TransactionDetail } from "@app/types/wallet";

export function ReceiptPage() {
  const { id = "" } = useParams();
  const [state, setState] = useState<AsyncState<TransactionDetail>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    wallet.getTransaction(id).then((result) => {
      if (cancelled) return;
      setState(result.ok ? { status: "success", data: result.data } : { status: "error", error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.status === "loading") return <Skeleton className="mx-auto h-96 w-full max-w-sm" />;
  if (state.status === "error") return <ErrorState error={state.error} />;
  if (state.status !== "success") return null;

  const txn = state.data;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 print:max-w-full">
      <Card className="text-center">
        <p className="font-display text-base font-semibold text-laupay-indigo">LAUPAY</p>
        <p className="mt-1 text-xs text-laupay-ink-muted">Payment receipt</p>

        <div className="my-5 flex justify-center">
          <StatusBadge status={txn.status} />
        </div>

        <p className="font-display text-3xl font-semibold text-laupay-ink">{formatNaira(txn.amount)}</p>
        <p className="mt-1 text-sm text-laupay-ink-muted">{txn.description}</p>

        <dl className="mt-6 flex flex-col gap-2.5 border-t border-dashed border-laupay-border pt-5 text-left text-sm">
          <Row label="Reference" value={txn.reference} />
          {txn.providerReference && <Row label="Provider reference" value={txn.providerReference} />}
          {txn.counterparty && <Row label="Recipient" value={txn.counterparty} />}
          <Row label="Date" value={formatDateTime(txn.createdAt)} />
        </dl>
      </Card>

      <div className="flex gap-2 print:hidden">
        <Button variant="secondary" fullWidth onClick={() => window.print()}>
          Print / save
        </Button>
        <Link
          to="/app/transactions"
          className="flex-1 rounded-md border border-laupay-border px-4 py-2.5 text-center text-sm font-medium text-laupay-ink hover:bg-laupay-surface-muted"
        >
          Back
        </Link>
      </div>
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
