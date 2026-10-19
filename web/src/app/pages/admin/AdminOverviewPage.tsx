import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { adminService } from "@app/admin/services";
import {
  LoadingRows,
  ModeBadge,
  PageHeader,
  StatCard,
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

export function AdminOverviewPage() {
  const state = useAsync(() => adminService.overview(), []);

  if (state.status === "loading") {
    return (
      <div>
        <PageHeader title="Overview" description="Live platform health." />
        <LoadingRows rows={4} />
      </div>
    );
  }
  if (state.status === "error") {
    return <ErrorState error={state.error} onRetry={state.reload} />;
  }

  const data = state.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description="Live platform health and recent activity."
        actions={
          <span className="inline-flex items-center gap-2 text-xs font-medium text-laupay-ink-muted">
            Fulfillment <ModeBadge mode={data.fulfillmentMode} />
          </span>
        }
      />

      <FundUserCard />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Users" value={data.users.total.toLocaleString()} hint={`${data.users.active} active`} />
        <StatCard
          label="Wallet balances"
          value={formatNaira(data.wallets.aggregateBalance)}
          hint={`${data.wallets.total} wallets`}
        />
        <StatCard label="Orders" value={data.orders.total.toLocaleString()} hint={`${data.orders.byStatus.FULFILLED ?? 0} fulfilled`} />
        <StatCard
          label="Pending payments"
          value={data.payments.pendingOrUnknown.toLocaleString()}
          hint="needs attention"
        />
        <StatCard label="Total credits" value={formatNaira(data.ledger.totalCredits)} hint="all-time ledger" />
        <StatCard label="Total debits" value={formatNaira(data.ledger.totalDebits)} hint="all-time ledger" />
        <StatCard label="Ledger entries today" value={data.ledger.entriesToday.toLocaleString()} />
        <StatCard label="VTU provider" value={String(data.providers.vtuProvider ?? "—")} hint={`mode: ${data.fulfillmentMode}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-laupay-border px-5 py-3.5">
            <h2 className="text-sm font-semibold text-laupay-ink">Recent users</h2>
            <Link to="/admin/users" className="text-xs font-medium text-laupay-indigo hover:underline">
              View all
            </Link>
          </div>
          <table className="w-full">
            <tbody>
              {data.recentUsers.map((u) => (
                <tr key={u.id} className="border-b border-laupay-border last:border-0">
                  <Td>
                    <span className="font-medium">{u.fullName}</span>
                    <span className="block text-xs text-laupay-ink-muted">{u.email}</span>
                  </Td>
                  <Td className="text-right">
                    <StatusBadge value={u.status} />
                  </Td>
                </tr>
              ))}
              {data.recentUsers.length === 0 && (
                <tr>
                  <Td className="text-laupay-ink-muted">No users yet.</Td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-laupay-border px-5 py-3.5">
            <h2 className="text-sm font-semibold text-laupay-ink">Recent transactions</h2>
            <Link to="/admin/transactions" className="text-xs font-medium text-laupay-indigo hover:underline">
              View all
            </Link>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Type</Th>
                <Th className="text-right">Amount</Th>
                <Th>When</Th>
              </tr>
            </thead>
            <tbody>
              {data.recentTransactions.map((t) => (
                <tr key={t.id} className="border-b border-laupay-border last:border-0">
                  <Td>{t.user?.fullName ?? "—"}</Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge value={t.direction} />
                      {t.source === "test_allocation" && (
                        <span className="inline-flex items-center rounded-full bg-laupay-surface-muted px-2 py-0.5 text-[10px] font-semibold text-laupay-ink-muted">
                          test
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td className="text-right font-medium">{formatNaira(t.amount)}</Td>
                  <Td className="whitespace-nowrap text-xs text-laupay-ink-muted">
                    {formatDateTime(t.createdAt)}
                  </Td>
                </tr>
              ))}
              {data.recentTransactions.length === 0 && (
                <tr>
                  <Td className="text-laupay-ink-muted">No transactions yet.</Td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

/**
 * Quick action on the dashboard: search for an account, select it, and credit
 * its wallet. Delegates to the audited, ledger-backed test-credit endpoint.
 */
function FundUserCard() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; fullName: string; email: string }[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<{ id: string; name: string; email: string } | null>(null);
  const [amount, setAmount] = useState("5000");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError(null);
    setNotice(null);
    const result = await adminService.users({ search: query.trim() || undefined, pageSize: 6 });
    setSearching(false);
    setSearched(true);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setResults(result.data.items.map((u) => ({ id: u.id, fullName: u.fullName, email: u.email })));
  }

  async function credit() {
    if (!selected) {
      setError("Pick a user first.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const value = Number(amount);
    const result = await adminService.creditTestFunds({
      userId: selected.id,
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
        : `Funded ${selected.name} ${formatNaira(String(value))}. New balance: ${formatNaira(result.data.balanceAfter)}.`,
    );
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-laupay-ink">Fund a user</h2>
      <p className="mt-1 text-xs leading-5 text-laupay-ink-muted">
        Search for an account, select it, and credit its wallet. Recorded in the ledger and audit
        log; the user sees it as a test credit from Ibrahim Lau Provision Shop.
      </p>

      <form onSubmit={search} className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Input
            label="Search user"
            value={query}
            placeholder="Email, name or phone"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button type="submit" loading={searching}>
          Search
        </Button>
      </form>

      {selected ? (
        <div className="mt-4 rounded-md border border-laupay-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-laupay-ink">{selected.name}</p>
              <p className="text-xs text-laupay-ink-muted">{selected.email}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs font-medium text-laupay-ink-muted hover:underline"
            >
              Change
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Input
                label="Amount (NGN)"
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <Button type="button" loading={busy} onClick={() => void credit()}>
              Credit funds
            </Button>
          </div>
        </div>
      ) : (
        results.length > 0 && (
          <ul className="mt-3 flex flex-col divide-y divide-laupay-border overflow-hidden rounded-md border border-laupay-border">
            {results.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setSelected({ id: u.id, name: u.fullName, email: u.email })}
                  className="flex w-full flex-col px-3 py-2 text-left hover:bg-laupay-surface-muted"
                >
                  <span className="text-sm font-medium text-laupay-ink">{u.fullName}</span>
                  <span className="text-xs text-laupay-ink-muted">{u.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {searched && !searching && results.length === 0 && !selected && (
        <p className="mt-3 text-xs text-laupay-ink-muted">No users found. Try a different search.</p>
      )}

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
  );
}
