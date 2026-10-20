import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ReactNode } from "react";
import { adminService } from "@app/admin/services";
import { LoadingRows, ModeBadge, PageHeader, ReasonDialog, StatusBadge, useAsync } from "@app/admin/ui";
import { Button } from "@app/components/ui/Button";
import { Card } from "@app/components/ui/Card";
import { ErrorState } from "@app/components/ui/ErrorState";
import { formatNaira, formatDateTime } from "@app/lib/format";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-laupay-border py-2.5 last:border-0">
      <dt className="text-sm text-laupay-ink-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-laupay-ink">{children}</dd>
    </div>
  );
}

export function AdminTransactionDetailPage() {
  const { id = "" } = useParams();
  const state = useAsync(() => adminService.transaction(id), [id]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reverse(reason: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await adminService.reverseEntry(id, reason);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setConfirming(false);
    setNotice("Reversal posted. A compensating ledger entry has been recorded.");
    state.reload();
  }

  if (state.status === "loading") {
    return (
      <div>
        <PageHeader title="Transaction" />
        <LoadingRows rows={6} />
      </div>
    );
  }
  if (state.status === "error") return <ErrorState error={state.error} onRetry={state.reload} />;

  const t = state.data;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link
          to="/admin/transactions"
          className="text-xs font-medium text-laupay-indigo hover:underline"
        >
          ← Back to transactions
        </Link>
        <PageHeader
          title={formatNaira(t.amount)}
          description={formatDateTime(t.createdAt)}
          actions={
            <div className="flex items-center gap-2">
              <StatusBadge value={t.direction} />
              <Button variant="danger" onClick={() => setConfirming(true)}>
                Reverse entry
              </Button>
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
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-laupay-ink">Ledger entry</h2>
          <ModeBadge mode={t.mode} />
        </div>
        <dl>
          <Row label="Narrative">{t.narrative ?? "—"}</Row>
          <Row label="Reason">{t.reason}</Row>
          <Row label="Source">{t.source ?? "—"}</Row>
          <Row label="Balance after">{formatNaira(t.balanceAfter)}</Row>
          <Row label="Reference">{t.referenceType ? `${t.referenceType} · ${t.referenceId}` : "—"}</Row>
          <Row label="Admin">
            {t.adminId ? <span className="font-mono text-xs">{t.adminId}</span> : "—"}
          </Row>
          <Row label="Entry ID">
            <span className="font-mono text-xs">{t.id}</span>
          </Row>
        </dl>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-laupay-ink">Account</h2>
        <dl>
          <Row label="User">{t.user?.fullName ?? "—"}</Row>
          <Row label="Email">{t.user?.email ?? "—"}</Row>
          <Row label="Phone">{t.user?.phone ?? "—"}</Row>
          <Row label="Wallet">
            {t.walletId ? <span className="font-mono text-xs">{t.walletId}</span> : "—"}
          </Row>
          <Row label="Currency">{t.currency}</Row>
        </dl>
      </Card>

      {t.relatedOrder && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-laupay-ink">Related order</h2>
          <dl>
            <Row label="Type">{t.relatedOrder.type}</Row>
            <Row label="Status">
              <StatusBadge value={t.relatedOrder.status} />
            </Row>
            <Row label="Network">{t.relatedOrder.network ?? "—"}</Row>
            <Row label="Phone">{t.relatedOrder.phoneNumber ?? "—"}</Row>
            <Row label="Amount">{formatNaira(t.relatedOrder.amount)}</Row>
            <Row label="Mode">
              <ModeBadge mode={t.relatedOrder.mode} />
            </Row>
          </dl>
        </Card>
      )}

      <ReasonDialog
        open={confirming}
        title={`Reverse ${formatNaira(t.amount)}?`}
        description="A compensating ledger entry will be posted. The original entry is never deleted."
        confirmLabel="Post reversal"
        danger
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={(reason) => void reverse(reason)}
      />
    </div>
  );
}
