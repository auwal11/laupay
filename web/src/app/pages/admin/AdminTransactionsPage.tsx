import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { adminService } from "@app/admin/services";
import {
  LoadingRows,
  ModeBadge,
  PageHeader,
  Pagination,
  StatusBadge,
  Td,
  Th,
  selectClass,
  useAsync,
} from "@app/admin/ui";
import { Button } from "@app/components/ui/Button";
import { Card } from "@app/components/ui/Card";
import { EmptyState } from "@app/components/ui/EmptyState";
import { ErrorState } from "@app/components/ui/ErrorState";
import { formatNaira, formatDateTime } from "@app/lib/format";

export function AdminTransactionsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);

  const state = useAsync(
    () =>
      adminService.transactions({
        search: search || undefined,
        direction: direction || undefined,
        source: source || undefined,
        page,
      }),
    [search, direction, source, page],
  );

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Every ledger entry across all wallets — the source of truth for balances."
      />

      <form onSubmit={onSearch} className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label htmlFor="txn-search" className="text-sm font-medium text-laupay-ink">
            Search
          </label>
          <input
            id="txn-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="User, narrative or reference"
            className={selectClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="txn-direction" className="text-sm font-medium text-laupay-ink">
            Direction
          </label>
          <select
            id="txn-direction"
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="">All</option>
            <option value="CREDIT">Credit</option>
            <option value="DEBIT">Debit</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="txn-source" className="text-sm font-medium text-laupay-ink">
            Source
          </label>
          <select
            id="txn-source"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="">All sources</option>
            <option value="test_allocation">Test allocation</option>
            <option value="order_payment">Order payment</option>
          </select>
        </div>
        <Button type="submit">Search</Button>
      </form>

      {state.status === "loading" && <LoadingRows />}
      {state.status === "error" && <ErrorState error={state.error} onRetry={state.reload} />}
      {state.status === "success" && (
        <>
          {state.data.items.length === 0 ? (
            <EmptyState title="No transactions found" description="Try adjusting your filters." />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>User</Th>
                    <Th>Type</Th>
                    <Th>Detail</Th>
                    <Th>Mode</Th>
                    <Th className="text-right">Amount</Th>
                    <Th className="text-right">Balance after</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {state.data.items.map((t) => (
                    <tr key={t.id} className="border-b border-laupay-border last:border-0">
                      <Td className="whitespace-nowrap text-xs text-laupay-ink-muted">
                        {formatDateTime(t.createdAt)}
                      </Td>
                      <Td>
                        <span className="font-medium">{t.user?.fullName ?? "—"}</span>
                        <span className="block text-xs text-laupay-ink-muted">{t.user?.email}</span>
                      </Td>
                      <Td>
                        <StatusBadge value={t.direction} />
                      </Td>
                      <Td className="max-w-[220px] truncate text-xs">
                        {t.narrative ?? t.source ?? t.reason}
                      </Td>
                      <Td>
                        <ModeBadge mode={t.mode} />
                      </Td>
                      <Td className="text-right font-medium">{formatNaira(t.amount)}</Td>
                      <Td className="text-right text-laupay-ink-muted">{formatNaira(t.balanceAfter)}</Td>
                      <Td className="text-right">
                        <Link
                          to={`/admin/transactions/${t.id}`}
                          className="text-xs font-medium text-laupay-indigo hover:underline"
                        >
                          View
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          <Pagination
            page={state.data.page}
            pageSize={state.data.pageSize}
            total={state.data.total}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
