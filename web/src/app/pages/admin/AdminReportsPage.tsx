import { useState } from "react";
import { adminService } from "@app/admin/services";
import { LoadingRows, PageHeader, StatCard, Td, Th, useAsync } from "@app/admin/ui";
import { Button } from "@app/components/ui/Button";
import { Card } from "@app/components/ui/Card";
import { ErrorState } from "@app/components/ui/ErrorState";
import { formatNaira } from "@app/lib/format";

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function AdminReportsPage() {
  const [from, setFrom] = useState(isoDaysAgo(7));
  const [to, setTo] = useState(isoDaysAgo(0));
  const state = useAsync(() => adminService.report(from, to), [from, to]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runReconciliation() {
    setBusy(true);
    setNotice(null);
    setError(null);
    const result = await adminService.runReconciliation();
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice(
      `Reconciliation completed: ${result.data.ordersTimedOut} orders timed out, ${result.data.paymentsExpired} payments expired.`,
    );
    state.reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        description="Fulfillment, refunds and ledger totals for a date range. Exports are generated server-side."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-laupay-ink-muted">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="ml-1 rounded-md border border-laupay-border px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-laupay-ink-muted">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="ml-1 rounded-md border border-laupay-border px-2 py-1.5 text-sm"
              />
            </label>
            <Button variant="secondary" loading={busy} onClick={() => void runReconciliation()}>
              Run reconciliation
            </Button>
          </div>
        }
      />

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

      {state.status === "loading" && <LoadingRows />}
      {state.status === "error" && <ErrorState error={state.error} onRetry={state.reload} />}
      {state.status === "success" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Fulfilled value"
              value={formatNaira(state.data.fulfilled.amount)}
              hint={`${state.data.fulfilled.count} orders`}
            />
            <StatCard
              label="Refunded value"
              value={formatNaira(state.data.refunded.amount)}
              hint={`${state.data.refunded.count} refunds`}
            />
            <StatCard label="Failed orders" value={state.data.failedCount.toLocaleString()} />
            <StatCard
              label="Ledger movement"
              value={formatNaira(state.data.ledger.credits)}
              hint={`debits ${formatNaira(state.data.ledger.debits)}`}
            />
          </div>

          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-laupay-border px-5 py-3.5">
              <h2 className="text-sm font-semibold text-laupay-ink">By product</h2>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => void adminService.exportOrdersCsv()}
                >
                  Orders CSV
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void adminService.exportTransactionsCsv()}
                >
                  Transactions CSV
                </Button>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Type</Th>
                  <Th className="text-right">Orders</Th>
                  <Th className="text-right">Value</Th>
                </tr>
              </thead>
              <tbody>
                {state.data.byType.map((row) => (
                  <tr key={row.type} className="border-b border-laupay-border last:border-0">
                    <Td className="font-medium">{row.type}</Td>
                    <Td className="text-right">{row.count}</Td>
                    <Td className="text-right font-medium">{formatNaira(row.amount)}</Td>
                  </tr>
                ))}
                {state.data.byType.length === 0 && (
                  <tr>
                    <Td className="text-laupay-ink-muted">No activity in this range.</Td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          <p className="text-xs text-laupay-ink-muted">
            Range: {state.data.range.from} → {state.data.range.to}. Figures are derived from the
            immutable ledger and order records.
          </p>
        </>
      )}
    </div>
  );
}
