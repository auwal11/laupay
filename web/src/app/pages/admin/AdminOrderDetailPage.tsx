import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminService } from "@app/admin/services";
import {
  LoadingRows,
  ModeBadge,
  PageHeader,
  ReasonDialog,
  StatusBadge,
  Td,
  Th,
  useAsync,
} from "@app/admin/ui";
import { Button } from "@app/components/ui/Button";
import { Card } from "@app/components/ui/Card";
import { ErrorState } from "@app/components/ui/ErrorState";
import { formatDateTime, formatNaira } from "@app/lib/format";

export function AdminOrderDetailPage() {
  const { id = "" } = useParams();
  const state = useAsync(() => adminService.order(id), [id]);
  const [pending, setPending] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    danger?: boolean;
    run: (reason: string) => Promise<{ ok: boolean; error?: { message: string } }>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(reason: string) {
    if (!pending) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    const result = await pending.run(reason);
    setBusy(false);
    if (!result.ok) {
      setError(result.error?.message ?? "Action failed.");
      return;
    }
    setPending(null);
    setNotice(`${pending.confirmLabel} recorded.`);
    state.reload();
  }

  if (state.status === "loading") {
    return (
      <div>
        <PageHeader title="Order" />
        <LoadingRows rows={6} />
      </div>
    );
  }
  if (state.status === "error") return <ErrorState error={state.error} onRetry={state.reload} />;

  const order = state.data;
  const canSettle = ["PAID", "FULFILLING", "FULFILLMENT_UNKNOWN", "FULFILLMENT_FAILED"].includes(order.status);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin/orders" className="text-xs font-medium text-laupay-indigo hover:underline">
          ← Back to orders
        </Link>
        <PageHeader
          title={`Order ${order.id.slice(0, 8).toUpperCase()}`}
          description={`${order.type} · ${order.phoneNumber ?? "no phone"}`}
          actions={
            <div className="flex items-center gap-2">
              <StatusBadge value={order.status} />
              <ModeBadge mode={order.mode} />
            </div>
          }
        />
      </div>

      {(notice || error) && (
        <p
          role={error ? "alert" : "status"}
          className={
            "rounded-lg px-4 py-3 text-sm font-medium " +
            (error ? "bg-red-50 text-laupay-danger" : "bg-green-50 text-laupay-success")
          }
        >
          {error ?? notice}
        </p>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-laupay-ink">Settlement actions</h2>
        <p className="mt-1 text-xs text-laupay-ink-muted">
          Marking an order successful or failed adjusts the ledger with a reversal entry — balances are
          never edited directly. All actions require a reason and are audited.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              setPending({
                title: "Retry fulfillment",
                description: "Re-sends this order to the provider. Safe to retry after unknown states.",
                confirmLabel: "Retry fulfillment",
                run: () => adminService.retryOrder(id),
              })
            }
          >
            Retry fulfillment
          </Button>
          <Button
            disabled={busy || !canSettle}
            onClick={() =>
              setPending({
                title: "Mark order successful",
                description:
                  "Use only after confirming the customer received value. Removes the pending refund hold.",
                confirmLabel: "Mark successful",
                run: (reason) => adminService.markOrderSuccessful(id, reason),
              })
            }
          >
            Mark successful
          </Button>
          <Button
            variant="danger"
            disabled={busy || !canSettle}
            onClick={() =>
              setPending({
                title: "Mark order failed and refund",
                description: "Reverses the customer debit and closes the order as refunded.",
                confirmLabel: "Fail and refund",
                danger: true,
                run: (reason) => adminService.markOrderFailed(id, reason),
              })
            }
          >
            Fail &amp; refund
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              setPending({
                title: "Open dispute",
                description: "Creates a tracked dispute for this order and notifies support.",
                confirmLabel: "Open dispute",
                run: (reason) => adminService.openDisputeFromOrder(id, reason),
              })
            }
          >
            Open dispute
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-laupay-ink-muted">Amount</p>
          <p className="mt-2 font-display text-2xl font-semibold text-laupay-ink">{formatNaira(order.amount)}</p>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <Row label="Customer" value={order.user?.fullName ?? "—"} />
            <Row label="Email" value={order.user?.email ?? "—"} />
            <Row label="Created" value={formatDateTime(order.createdAt)} />
            <Row label="Settled by" value={order.settledBy ?? "—"} />
            <Row label="Settled at" value={order.settledAt ? formatDateTime(order.settledAt) : "—"} />
          </dl>
          {order.failureReason && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-laupay-danger">{order.failureReason}</p>
          )}
        </Card>

        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-laupay-ink-muted">Fulfillment</p>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <Row label="Provider" value={order.vtuTransaction?.provider ?? "—"} />
            <Row label="Status" value={order.vtuTransaction?.status ?? "—"} />
            <Row label="Reference" value={order.vtuTransaction?.providerReference ?? "—"} />
            <Row label="Plan" value={order.dataPlan?.label ?? "—"} />
            <Row
              label="Updated"
              value={order.vtuTransaction ? formatDateTime(order.vtuTransaction.updatedAt) : "—"}
            />
          </dl>
        </Card>

        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-laupay-ink-muted">Payments</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {(order.payments ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{p.providerName ?? "wallet"}</p>
                  <p className="truncate text-xs text-laupay-ink-muted">{p.providerReference ?? p.id}</p>
                </div>
                <div className="text-right">
                  <StatusBadge value={p.status} />
                  <p className="mt-1 text-xs">{formatNaira(p.amount)}</p>
                </div>
              </li>
            ))}
            {(order.payments ?? []).length === 0 && (
              <li className="text-xs text-laupay-ink-muted">Paid from wallet balance.</li>
            )}
          </ul>
        </Card>
      </div>

      <Card className="p-0">
        <div className="border-b border-laupay-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-laupay-ink">Ledger entries</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Direction</Th>
                <Th>Reason</Th>
                <Th className="text-right">Amount</Th>
                <Th className="text-right">Balance after</Th>
              </tr>
            </thead>
            <tbody>
              {order.ledgerEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-laupay-border last:border-0">
                  <Td className="whitespace-nowrap text-xs text-laupay-ink-muted">{formatDateTime(entry.createdAt)}</Td>
                  <Td>
                    <StatusBadge value={entry.direction} />
                  </Td>
                  <Td className="text-xs">{entry.narrative ?? entry.reason}</Td>
                  <Td className="text-right font-medium">{formatNaira(entry.amount)}</Td>
                  <Td className="text-right text-laupay-ink-muted">{formatNaira(entry.balanceAfter)}</Td>
                </tr>
              ))}
              {order.ledgerEntries.length === 0 && (
                <tr>
                  <Td className="text-laupay-ink-muted">No ledger entries.</Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {order.vtuTransaction?.rawResponse != null && (
        <Card>
          <h2 className="text-sm font-semibold text-laupay-ink">Provider response</h2>
          <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-laupay-ink px-4 py-3 text-xs text-white">
            {JSON.stringify(order.vtuTransaction.rawResponse, null, 2)}
          </pre>
        </Card>
      )}

      <ReasonDialog
        open={pending !== null}
        title={pending?.title ?? ""}
        description={pending?.description}
        confirmLabel={pending?.confirmLabel}
        danger={pending?.danger}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => void run(reason)}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-laupay-ink-muted">{label}</dt>
      <dd className="break-all text-right font-medium">{value}</dd>
    </div>
  );
}
