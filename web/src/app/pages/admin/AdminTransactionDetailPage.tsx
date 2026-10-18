import { Link, useParams } from "react-router-dom";
import type { ReactNode } from "react";
import { adminService } from "@app/admin/services";
import { LoadingRows, ModeBadge, PageHeader, StatusBadge, useAsync } from "@app/admin/ui";
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
          actions={<StatusBadge value={t.direction} />}
        />
      </div>

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
    </div>
  );
}
