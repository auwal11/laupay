import { useState } from "react";
import type { FormEvent } from "react";
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

const ORDER_STATUSES = [
  "CREATED",
  "PRICED",
  "PAID",
  "FULFILLING",
  "FULFILLED",
  "FULFILLMENT_FAILED",
  "FULFILLMENT_UNKNOWN",
  "REFUNDED",
  "CANCELLED",
];

export function AdminOrdersPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const state = useAsync(
    () =>
      adminService.orders({
        search: search || undefined,
        type: type || undefined,
        status: status || undefined,
        page,
      }),
    [search, type, status, page],
  );

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <div>
      <PageHeader title="Orders" description="Airtime and data orders across all accounts." />

      <form onSubmit={onSearch} className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label htmlFor="order-search" className="text-sm font-medium text-laupay-ink">
            Search
          </label>
          <input
            id="order-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Phone, user or order id"
            className={selectClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="order-type" className="text-sm font-medium text-laupay-ink">
            Type
          </label>
          <select
            id="order-type"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="">All types</option>
            <option value="AIRTIME">Airtime</option>
            <option value="DATA">Data</option>
            <option value="BILL">Bill</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="order-status" className="text-sm font-medium text-laupay-ink">
            Status
          </label>
          <select
            id="order-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">Search</Button>
      </form>

      {state.status === "loading" && <LoadingRows />}
      {state.status === "error" && <ErrorState error={state.error} onRetry={state.reload} />}
      {state.status === "success" && (
        <>
          {state.data.items.length === 0 ? (
            <EmptyState title="No orders found" description="Try adjusting your filters." />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>User</Th>
                    <Th>Type</Th>
                    <Th>Phone</Th>
                    <Th>Status</Th>
                    <Th>Mode</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.items.map((o) => (
                    <tr key={o.id} className="border-b border-laupay-border last:border-0">
                      <Td className="whitespace-nowrap text-xs text-laupay-ink-muted">
                        {formatDateTime(o.createdAt)}
                      </Td>
                      <Td>
                        <span className="font-medium">{o.user?.fullName ?? "—"}</span>
                        <span className="block text-xs text-laupay-ink-muted">{o.user?.email}</span>
                      </Td>
                      <Td>{o.type}</Td>
                      <Td className="text-xs">{o.phoneNumber ?? "—"}</Td>
                      <Td>
                        <StatusBadge value={o.status} />
                      </Td>
                      <Td>
                        <ModeBadge mode={o.mode} />
                      </Td>
                      <Td className="text-right font-medium">{formatNaira(o.amount)}</Td>
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
