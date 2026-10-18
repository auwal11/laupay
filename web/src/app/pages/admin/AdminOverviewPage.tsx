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
import { Card } from "@app/components/ui/Card";
import { ErrorState } from "@app/components/ui/ErrorState";
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
