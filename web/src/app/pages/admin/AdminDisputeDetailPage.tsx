import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { adminService } from "@app/admin/services";
import {
  LoadingRows,
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

type Pending = {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  run: (reason: string) => Promise<{ ok: boolean; error?: { message: string } }>;
};

export function AdminDisputeDetailPage() {
  const { id = "" } = useParams();
  const state = useAsync(() => adminService.dispute(id), [id]);
  const [staff, setStaff] = useState<Array<{ id: string; label: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [admin, support] = await Promise.all([
        adminService.users({ role: "ADMIN", pageSize: 50 }),
        adminService.users({ role: "SUPPORT", pageSize: 50 }),
      ]);
      if (cancelled) return;
      const rows = [...(admin.ok ? admin.data.items : []), ...(support.ok ? support.data.items : [])];
      setStaff(rows.map((u) => ({ id: u.id, label: `${u.fullName} (${u.email})` })));
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [internal, setInternal] = useState(false);
  const [adminId, setAdminId] = useState("");

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

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (message.trim().length === 0) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    const result = await adminService.addDisputeMessage(id, message.trim(), internal);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setMessage("");
    state.reload();
  }

  async function assign() {
    if (!adminId) return;
    setPending({
      title: "Assign case",
      description: "The selected staff member becomes the owner of this case.",
      confirmLabel: "Assign case",
      run: (reason) => adminService.assignDispute(id, adminId, reason),
    });
  }

  if (state.status === "loading") {
    return (
      <div>
        <PageHeader title="Dispute" />
        <LoadingRows rows={6} />
      </div>
    );
  }
  if (state.status === "error") return <ErrorState error={state.error} onRetry={state.reload} />;

  const dispute = state.data;
  const closed = dispute.status === "RESOLVED" || dispute.status === "REJECTED" || dispute.status === "CLOSED";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin/disputes" className="text-xs font-medium text-laupay-indigo hover:underline">
          ← Back to disputes
        </Link>
        <PageHeader
          title={dispute.caseReference}
          description={`${dispute.reason.replace(/_/g, " ")} · opened ${formatDateTime(dispute.createdAt)}`}
          actions={<StatusBadge value={dispute.status} />}
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-laupay-ink-muted">Customer</p>
          <p className="mt-2 text-sm font-semibold text-laupay-ink">{dispute.userName}</p>
          <p className="text-xs text-laupay-ink-muted">{dispute.userEmail}</p>
          {dispute.order && (
            <p className="mt-3 text-xs text-laupay-ink-muted">
              Order:{" "}
              <Link to={`/admin/orders/${dispute.order.id}`} className="text-laupay-indigo hover:underline">
                {dispute.order.id.slice(0, 8).toUpperCase()}
              </Link>
            </p>
          )}
        </Card>

        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-laupay-ink-muted">Transaction</p>
          <p className="mt-2 font-display text-xl font-semibold text-laupay-ink">
            {dispute.direction === "CREDIT" ? "+" : "−"}
            {formatNaira(dispute.amount)}
          </p>
          <dl className="mt-2 flex flex-col gap-1 text-xs text-laupay-ink-muted">
            <div className="flex justify-between gap-2">
              <dt>Reason</dt>
              <dd className="text-right font-medium text-laupay-ink">
                {dispute.ledgerEntry.reason.replace(/_/g, " ")}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Posted</dt>
              <dd className="text-right">{formatDateTime(dispute.ledgerEntry.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Balance after</dt>
              <dd className="text-right">{formatNaira(dispute.ledgerEntry.balanceAfter)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Reference</dt>
              <dd className="break-all text-right">{dispute.ledgerEntry.referenceId ?? "—"}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-laupay-ink-muted">Assignment</p>
          <p className="mt-2 text-sm text-laupay-ink">
            {dispute.assignedAdmin ? dispute.assignedAdmin.fullName : "Unassigned"}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <select
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              className="rounded-md border border-laupay-border bg-white px-3 py-2 text-sm"
            >
              <option value="">Choose staff…</option>
              {staff.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            <Button variant="secondary" disabled={!adminId || busy} onClick={() => void assign()}>
              Assign case
            </Button>
            {dispute.status === "OPEN" && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setPending({
                  title: "Start review",
                  description: "Marks this case as actively being investigated.",
                  confirmLabel: "Start review",
                  run: (reason) => adminService.updateDispute(id, "IN_REVIEW", reason),
                })}
              >
                Start review
              </Button>
            )}
          </div>
        </Card>
      </div>

      {dispute.details && (
        <Card>
          <h2 className="text-sm font-semibold text-laupay-ink">Customer statement</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-laupay-ink">{dispute.details}</p>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-laupay-ink">Resolution</h2>
        <p className="mt-1 text-xs text-laupay-ink-muted">
          A refund creates a ledger credit that exactly reverses the disputed transaction. Rejecting
          records the decision without moving money.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={busy || closed}
            onClick={() =>
              setPending({
                title: `Refund ${formatNaira(dispute.amount)}`,
                description: "Credits the customer's wallet and resolves the case as refunded.",
                confirmLabel: "Approve refund",
                run: (reason) => adminService.refundDispute(id, reason),
              })
            }
          >
            Approve refund
          </Button>
          <Button
            variant="danger"
            disabled={busy || closed}
            onClick={() =>
              setPending({
                title: "Reject dispute",
                description: "Records a rejection. No money moves.",
                confirmLabel: "Reject dispute",
                danger: true,
                run: (reason) => adminService.rejectDispute(id, reason),
              })
            }
          >
            Reject
          </Button>
          {(dispute.status === "RESOLVED" || dispute.status === "REJECTED") && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setPending({
                title: "Close case",
                description: "Archives this case as closed.",
                confirmLabel: "Close case",
                run: (reason) => adminService.updateDispute(id, "CLOSED", reason),
              })}
            >
              Close case
            </Button>
          )}
        </div>
        {dispute.resolutionNote && (
          <p className="mt-3 rounded-md bg-laupay-surface-muted px-3 py-2 text-xs text-laupay-ink">
            Resolution note: {dispute.resolutionNote}
          </p>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-laupay-ink">Case thread</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {dispute.messages.map((m) => (
            <li
              key={m.id}
              className={
                "rounded-md px-3 py-2 text-sm " +
                (m.internal ? "bg-amber-50 text-laupay-ink" : "bg-laupay-surface-muted text-laupay-ink")
              }
            >
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className="mt-1 text-[11px] text-laupay-ink-muted">
                {m.authorType.toLowerCase()}
                {m.internal ? " · internal" : ""} · {formatDateTime(m.createdAt)}
              </p>
            </li>
          ))}
          {dispute.messages.length === 0 && (
            <li className="text-xs text-laupay-ink-muted">No messages yet.</li>
          )}
        </ul>
        <form onSubmit={sendMessage} className="mt-4 flex flex-col gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Add a note or customer-facing reply"
            className="w-full rounded-md border border-laupay-border px-3 py-2 text-sm"
          />
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-laupay-ink-muted">
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
              Internal note (not shown to customer)
            </label>
            <Button type="submit" loading={busy} disabled={message.trim().length === 0}>
              Post message
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-0">
        <div className="border-b border-laupay-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-laupay-ink">Ledger context</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <Th>Reason</Th>
              <Th>Direction</Th>
              <Th className="text-right">Amount</Th>
              <Th className="text-right">Balance after</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td className="text-xs">{dispute.ledgerEntry.reason.replace(/_/g, " ")}</Td>
              <Td>
                <StatusBadge value={dispute.ledgerEntry.direction} />
              </Td>
              <Td className="text-right font-medium">{formatNaira(dispute.ledgerEntry.amount)}</Td>
              <Td className="text-right text-laupay-ink-muted">{formatNaira(dispute.ledgerEntry.balanceAfter)}</Td>
            </tr>
          </tbody>
        </table>
      </Card>

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
