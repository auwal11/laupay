import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { adminService } from "@app/admin/services";
import {
  LoadingRows,
  ModeBadge,
  PageHeader,
  ReasonDialog,
  RoleBadge,
  StatusBadge,
  Td,
  Th,
  useAsync,
} from "@app/admin/ui";
import { Button } from "@app/components/ui/Button";
import { Card } from "@app/components/ui/Card";
import { ErrorState } from "@app/components/ui/ErrorState";
import { Input } from "@app/components/ui/Input";
import { formatDateTime, formatNaira } from "@app/lib/format";

type PendingAction = {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  requireToken?: string;
  run: (reason: string) => Promise<{ ok: boolean; error?: { message: string } }>;
};

export function AdminUserDetailPage() {
  const { id = "" } = useParams();
  const state = useAsync(() => adminService.user(id), [id]);
  const [amount, setAmount] = useState("5000");
  const [creditReason, setCreditReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [note, setNote] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [role, setRole] = useState("");
  const [roleReason, setRoleReason] = useState("");

  function flash(message: string | null, err: string | null) {
    setNotice(message);
    setError(err);
  }

  async function credit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    flash(null, null);
    const value = Number(amount);
    if (creditReason.trim().length < 5) {
      flash(null, "Enter a reason of at least 5 characters.");
      return;
    }
    const result = await adminService.creditWallet({
      userId: id,
      amount: value,
      reason: creditReason.trim(),
      idempotencyKey: crypto.randomUUID(),
    });
    setBusy(false);
    if (!result.ok) {
      flash(null, result.error.message);
      return;
    }
    flash(
      result.data.wasAlreadyApplied
        ? "This credit was already applied."
        : `Credited ${formatNaira(String(value))}. New balance: ${formatNaira(result.data.balanceAfter)}.`,
      null,
    );
    state.reload();
  }

  async function walletStatus(action: "freeze" | "unfreeze", walletId: string) {
    setPending({
      title: action === "freeze" ? "Freeze wallet" : "Reactivate wallet",
      description:
        action === "freeze"
          ? "The customer cannot spend from this wallet until it is reactivated."
          : "Spending will be allowed again on this wallet.",
      confirmLabel: action === "freeze" ? "Freeze wallet" : "Reactivate wallet",
      danger: action === "freeze",
      run: (reason) => adminService.setWalletStatus(walletId, action, reason),
    });
  }

  async function runPending(reason: string) {
    if (!pending) return;
    setBusy(true);
    const result = await pending.run(reason);
    setBusy(false);
    if (!result.ok) {
      flash(null, result.error?.message ?? "Action failed.");
      return;
    }
    setPending(null);
    flash("Action completed and recorded in the audit log.", null);
    state.reload();
  }

  async function saveNote(e: FormEvent) {
    e.preventDefault();
    if (note.trim().length < 2) return;
    setNoteBusy(true);
    flash(null, null);
    const result = await adminService.addNote(id, note.trim());
    setNoteBusy(false);
    if (!result.ok) {
      flash(null, result.error.message);
      return;
    }
    setNote("");
    state.reload();
  }

  async function saveRole(e: FormEvent) {
    e.preventDefault();
    if (!role) return;
    setBusy(true);
    flash(null, null);
    const result = await adminService.setRole(id, role, roleReason);
    setBusy(false);
    if (!result.ok) {
      flash(null, result.error.message);
      return;
    }
    setRoleReason("");
    flash("Role updated.", null);
    state.reload();
  }

  if (state.status === "loading") {
    return (
      <div>
        <PageHeader title="User" />
        <LoadingRows rows={6} />
      </div>
    );
  }
  if (state.status === "error") return <ErrorState error={state.error} onRetry={state.reload} />;

  const user = state.data;
  // Keep the action reliable even if an older API/database adapter returns
  // whitespace or a differently-cased enum string.
  const normalizedStatus = String(user.status ?? "").trim().toUpperCase();
  const isClosed = normalizedStatus === "CLOSED";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin/users" className="text-xs font-medium text-laupay-indigo hover:underline">
          ← Back to users
        </Link>
        <PageHeader
          title={user.fullName}
          description={user.email}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <RoleBadge value={user.role} />
              <StatusBadge value={user.status} />
              {typeof user.riskEvents?.length === "number" && user.riskEvents.length > 0 && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-laupay-pending">
                  {user.riskEvents.length} risk events
                </span>
              )}
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
        <h2 className="text-sm font-semibold text-laupay-ink">Account actions</h2>
        <p className="mt-1 text-xs text-laupay-ink-muted">
          Every action requires a written reason and is written to the immutable audit log.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {isClosed ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                setPending({
                  title: "Reopen account",
                  description: "This customer will regain access. Existing ledger history remains unchanged.",
                  confirmLabel: "Reopen account",
                  run: (reason) => adminService.setUserStatus(id, "reopen", reason),
                })
              }
            >
              Reopen account
            </Button>
          ) : user.status === "FROZEN" ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                setPending({
                  title: "Unfreeze account",
                  description: "The customer will regain access to the app and wallet.",
                  confirmLabel: "Unfreeze account",
                  run: (reason) => adminService.setUserStatus(id, "unfreeze", reason),
                })
              }
            >
              Unfreeze account
            </Button>
          ) : (
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                setPending({
                  title: "Freeze account",
                  description: "Blocks login and all money movement for this account.",
                  confirmLabel: "Freeze account",
                  danger: true,
                  run: (reason) => adminService.setUserStatus(id, "freeze", reason),
                })
              }
            >
              Freeze account
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              setPending({
                title: "Force sign-out",
                description: "Revokes active sessions. The customer must sign in again.",
                confirmLabel: "Force sign-out",
                run: (reason) => adminService.forceLogout(id, reason),
              })
            }
          >
            Force sign-out
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              setPending({
                title: "Reset transaction PIN",
                description: "The customer must set a new PIN before transacting again.",
                confirmLabel: "Reset PIN",
                danger: true,
                run: (reason) => adminService.resetPin(id, reason),
              })
            }
          >
            Reset PIN
          </Button>
          {!user.emailVerified && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                setPending({
                  title: "Mark email verified",
                  description: "Manually verifies this email after offline checks.",
                  confirmLabel: "Mark verified",
                  run: (reason) => adminService.markVerified(id, "email", reason),
                })
              }
            >
              Verify email
            </Button>
          )}
          {!user.phoneVerified && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                setPending({
                  title: "Mark phone verified",
                  description: "Manually verifies this phone number after offline checks.",
                  confirmLabel: "Mark verified",
                  run: (reason) => adminService.markVerified(id, "phone", reason),
                })
              }
            >
              Verify phone
            </Button>
          )}
          {!isClosed && (
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                setPending({
                  title: "Close account",
                  description:
                    "Permanently closes this account. Ledger history is retained and cannot be deleted.",
                  confirmLabel: "Close account",
                  danger: true,
                  requireToken: "CLOSE",
                  run: (reason) => adminService.setUserStatus(id, "close", reason),
                })
              }
            >
              Close account
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-laupay-ink-muted">Wallet balance</p>
          <p className="mt-2 font-display text-2xl font-semibold text-laupay-ink">
            {user.walletAccount ? formatNaira(user.walletAccount.balance) : "—"}
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-laupay-ink-muted">
            {user.walletAccount && <StatusBadge value={user.walletAccount.status} />}
            {user.walletAccount && <span>{user.walletAccount.currency}</span>}
          </div>
          {user.walletAccount && (
            <div className="mt-4">
              {user.walletAccount.status === "FROZEN" ? (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void walletStatus("unfreeze", user.walletAccount!.id)}
                >
                  Reactivate wallet
                </Button>
              ) : (
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => void walletStatus("freeze", user.walletAccount!.id)}
                >
                  Freeze wallet
                </Button>
              )}
              {user.walletAccount.status === "ACTIVE" && Number(user.walletAccount.balance) > 0 && (
                <Button
                  className="mt-2"
                  variant="danger"
                  disabled={busy}
                  onClick={() =>
                    setPending({
                      title: "Debit entire wallet balance",
                      description: `This will debit the current available balance of ${formatNaira(user.walletAccount!.balance)} through the ledger. The balance is re-read and verified on the server. This cannot be undone except through a separately authorized ledger reversal.`,
                      confirmLabel: "Debit entire balance",
                      danger: true,
                      requireToken: "DEBIT ALL",
                      run: (reason) =>
                        adminService.debitWalletBalance({
                          userId: id,
                          reason,
                          idempotencyKey: crypto.randomUUID(),
                        }),
                    })
                  }
                >
                  Debit entire balance
                </Button>
              )}
            </div>
          )}
        </Card>

        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-laupay-ink-muted">Details</p>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-laupay-ink-muted">Phone</dt>
              <dd className="text-right font-medium">
                {user.phone ?? "—"}
                {user.phoneVerified && <span className="ml-1 text-[11px] text-laupay-success">verified</span>}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-laupay-ink-muted">Email</dt>
              <dd className="text-right font-medium">
                {user.emailVerified ? "verified" : "unverified"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-laupay-ink-muted">Transaction PIN</dt>
              <dd className="font-medium">
                {user.hasPin ? "Set" : "Not set"}
                {user.pinLockedUntil ? " · locked" : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-laupay-ink-muted">Last sign-in</dt>
              <dd className="text-right font-medium">
                {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}
                {user.lastLoginIp && <span className="block text-[11px] text-laupay-ink-muted">{user.lastLoginIp}</span>}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-laupay-ink-muted">Registered</dt>
              <dd className="font-medium">{formatDateTime(user.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-laupay-ink-muted">Test credit</dt>
              <dd className="text-right font-medium">
                {user.testCreditGrantedAt ? formatDateTime(user.testCreditGrantedAt) : "Not granted"}
              </dd>
            </div>
          </dl>
          {user.frozenReason && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-laupay-danger">
              Frozen reason: {user.frozenReason}
            </p>
          )}
        </Card>

        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-laupay-ink-muted">Credit wallet</p>
          <p className="mt-1 text-xs leading-5 text-laupay-ink-muted">
            Ledger-backed adjustment from Ibrahim Lau Provision Shop. Reversible only through the
            ledger reversal workflow.
          </p>
          <form onSubmit={credit} className="mt-3 flex flex-col gap-3">
            <Input
              label="Amount (NGN)"
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <Input
              label="Reason (required, audited)"
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
              required
            />
            <Button type="submit" loading={busy} disabled={creditReason.trim().length < 5}>
              Credit wallet
            </Button>
          </form>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-laupay-ink">Internal notes</h2>
          <form onSubmit={saveNote} className="mt-3 flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Visible only to staff"
              className="min-w-0 flex-1 rounded-md border border-laupay-border px-3 py-2 text-sm"
            />
            <Button type="submit" loading={noteBusy} disabled={note.trim().length < 2}>
              Add
            </Button>
          </form>
          <ul className="mt-4 flex flex-col gap-3">
            {user.notes.map((n) => (
              <li key={n.id} className="rounded-md bg-laupay-surface-muted px-3 py-2 text-sm">
                <p className="text-laupay-ink">{n.body}</p>
                <p className="mt-1 text-[11px] text-laupay-ink-muted">
                  {n.admin?.email ?? "system"} · {formatDateTime(n.createdAt)}
                </p>
              </li>
            ))}
            {user.notes.length === 0 && <li className="text-xs text-laupay-ink-muted">No notes yet.</li>}
          </ul>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-laupay-ink">Role</h2>
          <p className="mt-1 text-xs text-laupay-ink-muted">
            Only ADMIN accounts can access the console. Change this for staff onboarding/offboarding.
          </p>
          <form onSubmit={saveRole} className="mt-3 flex flex-col gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-md border border-laupay-border bg-white px-3 py-2 text-sm"
            >
              <option value="">Choose role…</option>
              <option value="ADMIN">ADMIN</option>
              <option value="FINANCE">FINANCE</option>
              <option value="SUPPORT">SUPPORT</option>
              <option value="VIEWER">VIEWER</option>
              <option value="CUSTOMER">CUSTOMER</option>
            </select>
            <input
              value={roleReason}
              onChange={(e) => setRoleReason(e.target.value)}
              placeholder="Reason (required)"
              className="rounded-md border border-laupay-border px-3 py-2 text-sm"
            />
            <Button type="submit" loading={busy} disabled={!role || roleReason.trim().length < 5}>
              Update role
            </Button>
          </form>
        </Card>
      </div>

      <Card className="p-0">
        <div className="border-b border-laupay-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-laupay-ink">Recent transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Source</Th>
                <Th className="text-right">Amount</Th>
                <Th className="text-right">Balance after</Th>
              </tr>
            </thead>
            <tbody>
              {user.transactions.map((t) => (
                <tr key={t.id} className="border-b border-laupay-border last:border-0">
                  <Td className="whitespace-nowrap text-xs text-laupay-ink-muted">{formatDateTime(t.createdAt)}</Td>
                  <Td>
                    <StatusBadge value={t.direction} />
                  </Td>
                  <Td className="text-xs">{t.narrative ?? t.source ?? t.reason}</Td>
                  <Td className="text-right font-medium">{formatNaira(t.amount)}</Td>
                  <Td className="text-right text-laupay-ink-muted">{formatNaira(t.balanceAfter)}</Td>
                </tr>
              ))}
              {user.transactions.length === 0 && (
                <tr>
                  <Td className="text-laupay-ink-muted">No transactions yet.</Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-0">
          <div className="border-b border-laupay-border px-5 py-3.5">
            <h2 className="text-sm font-semibold text-laupay-ink">Recent orders</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Mode</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {user.orders.map((o) => (
                  <tr key={o.id} className="border-b border-laupay-border last:border-0">
                    <Td className="whitespace-nowrap text-xs text-laupay-ink-muted">
                      <Link to={`/admin/orders/${o.id}`} className="text-laupay-indigo hover:underline">
                        {formatDateTime(o.createdAt)}
                      </Link>
                    </Td>
                    <Td>{o.type}</Td>
                    <Td>
                      <StatusBadge value={o.status} />
                    </Td>
                    <Td>
                      <ModeBadge mode={o.mode} />
                    </Td>
                    <Td className="text-right font-medium">{formatNaira(o.amount)}</Td>
                  </tr>
                ))}
                {user.orders.length === 0 && (
                  <tr>
                    <Td className="text-laupay-ink-muted">No orders yet.</Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-0">
          <div className="border-b border-laupay-border px-5 py-3.5">
            <h2 className="text-sm font-semibold text-laupay-ink">Disputes</h2>
          </div>
          <ul className="flex flex-col">
            {user.disputes.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 border-b border-laupay-border px-5 py-3 last:border-0">
                <div className="min-w-0">
                  <Link to={`/admin/disputes/${d.id}`} className="text-sm font-medium text-laupay-indigo hover:underline">
                    {d.caseReference}
                  </Link>
                  <p className="truncate text-xs text-laupay-ink-muted">{d.reason.replace(/_/g, " ")}</p>
                </div>
                <StatusBadge value={d.status} />
              </li>
            ))}
            {user.disputes.length === 0 && (
              <li className="px-5 py-4 text-sm text-laupay-ink-muted">No disputes.</li>
            )}
          </ul>
        </Card>
      </div>

      <Card className="p-0">
        <div className="border-b border-laupay-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-laupay-ink">Risk events</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Type</Th>
                <Th>Severity</Th>
                <Th>Decision</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {user.riskEvents.map((event) => (
                <tr key={event.id} className="border-b border-laupay-border last:border-0">
                  <Td className="whitespace-nowrap text-xs text-laupay-ink-muted">{formatDateTime(event.createdAt)}</Td>
                  <Td className="text-sm">{event.type.replace(/_/g, " ")}</Td>
                  <Td>
                    <StatusBadge value={event.severity} />
                  </Td>
                  <Td className="text-xs text-laupay-ink-muted">{event.decision?.replace(/_/g, " ") ?? "—"}</Td>
                  <Td className="text-right font-medium">{event.amount ? formatNaira(event.amount) : "—"}</Td>
                </tr>
              ))}
              {user.riskEvents.length === 0 && (
                <tr>
                  <Td className="text-laupay-ink-muted">No risk events.</Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ReasonDialog
        open={pending !== null}
        title={pending?.title ?? ""}
        description={pending?.description}
        confirmLabel={pending?.confirmLabel}
        danger={pending?.danger}
        requireToken={pending?.requireToken}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => void runPending(reason)}
      />
    </div>
  );
}
