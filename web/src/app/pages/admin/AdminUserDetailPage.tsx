import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { adminService } from "@app/admin/services";
import {
  LoadingRows,
  ModeBadge,
  PageHeader,
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
import { formatNaira, formatDateTime } from "@app/lib/format";

export function AdminUserDetailPage() {
  const { id = "" } = useParams();
  const state = useAsync(() => adminService.user(id), [id]);
  const [amount, setAmount] = useState("5000");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function credit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    setError(null);
    const value = Number(amount);
    const result = await adminService.creditTestFunds({
      userId: id,
      amount: value,
      idempotencyKey: crypto.randomUUID(),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice(
      result.data.wasAlreadyApplied
        ? "This credit was already applied."
        : `Credited ${formatNaira(String(value))}. New balance: ${formatNaira(result.data.balanceAfter)}.`,
    );
    state.reload();
  }

  async function toggleWallet(action: "freeze" | "unfreeze", walletId: string) {
    setBusy(true);
    setNotice(null);
    setError(null);
    const result = await adminService.setWalletStatus(walletId, action);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice(action === "freeze" ? "Wallet frozen." : "Wallet reactivated.");
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
            <div className="flex items-center gap-2">
              <RoleBadge value={user.role} />
              <StatusBadge value={user.status} />
            </div>
          }
        />
      </div>

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
                  onClick={() => toggleWallet("unfreeze", user.walletAccount!.id)}
                >
                  Reactivate wallet
                </Button>
              ) : (
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => toggleWallet("freeze", user.walletAccount!.id)}
                >
                  Freeze wallet
                </Button>
              )}
            </div>
          )}
        </Card>

        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-laupay-ink-muted">Details</p>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-laupay-ink-muted">Phone</dt>
              <dd className="font-medium">{user.phone ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-laupay-ink-muted">Transaction PIN</dt>
              <dd className="font-medium">{user.hasPin ? "Set" : "Not set"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-laupay-ink-muted">Registered</dt>
              <dd className="font-medium">{formatDateTime(user.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-laupay-ink-muted">Test credit</dt>
              <dd className="font-medium">
                {user.testCreditGrantedAt ? formatDateTime(user.testCreditGrantedAt) : "Not granted"}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-laupay-ink-muted">
            Test credit
          </p>
          <p className="mt-1 text-xs leading-5 text-laupay-ink-muted">
            Adds funds to this user's wallet and records an audit entry. Visible to the user as a
            test credit from Ibrahim Lau Provision Shop.
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
            <Button type="submit" loading={busy}>
              Credit test funds
            </Button>
          </form>
          {notice && (
            <p role="status" className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs font-medium text-laupay-success">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-laupay-danger">
              {error}
            </p>
          )}
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
                  <Td className="whitespace-nowrap text-xs text-laupay-ink-muted">
                    {formatDateTime(t.createdAt)}
                  </Td>
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
                    {formatDateTime(o.createdAt)}
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
    </div>
  );
}
