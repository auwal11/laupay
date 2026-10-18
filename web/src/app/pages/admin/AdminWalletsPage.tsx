import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { adminService } from "@app/admin/services";
import {
  LoadingRows,
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

export function AdminWalletsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const state = useAsync(
    () => adminService.wallets({ search: search || undefined, status: status || undefined, page }),
    [search, status, page],
  );

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  async function toggle(id: string, action: "freeze" | "unfreeze") {
    setBusyId(id);
    setError(null);
    const result = await adminService.setWalletStatus(id, action);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    state.reload();
  }

  return (
    <div>
      <PageHeader title="Wallets" description="Wallet balances and status across the platform." />

      <form onSubmit={onSearch} className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label htmlFor="wallet-search" className="text-sm font-medium text-laupay-ink">
            Search
          </label>
          <input
            id="wallet-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Owner email, name or phone"
            className={selectClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wallet-status" className="text-sm font-medium text-laupay-ink">
            Status
          </label>
          <select
            id="wallet-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="FROZEN">Frozen</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <Button type="submit">Search</Button>
      </form>

      {error && (
        <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-laupay-danger">
          {error}
        </p>
      )}

      {state.status === "loading" && <LoadingRows />}
      {state.status === "error" && <ErrorState error={state.error} onRetry={state.reload} />}
      {state.status === "success" && (
        <>
          {state.data.items.length === 0 ? (
            <EmptyState title="No wallets found" description="Try adjusting your filters." />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>Owner</Th>
                    <Th>Type</Th>
                    <Th className="text-right">Balance</Th>
                    <Th>Status</Th>
                    <Th>Updated</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {state.data.items.map((w) => (
                    <tr key={w.id} className="border-b border-laupay-border last:border-0">
                      <Td>
                        <Link
                          to={`/admin/users/${w.ownerId}`}
                          className="font-medium text-laupay-indigo hover:underline"
                        >
                          {w.user?.fullName ?? w.ownerId}
                        </Link>
                        <span className="block text-xs text-laupay-ink-muted">{w.user?.email}</span>
                      </Td>
                      <Td className="text-xs text-laupay-ink-muted">{w.ownerType}</Td>
                      <Td className="text-right font-medium">{formatNaira(w.balance)}</Td>
                      <Td>
                        <StatusBadge value={w.status} />
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-laupay-ink-muted">
                        {formatDateTime(w.updatedAt)}
                      </Td>
                      <Td className="text-right">
                        {w.status === "FROZEN" ? (
                          <Button
                            variant="secondary"
                            disabled={busyId === w.id}
                            onClick={() => toggle(w.id, "unfreeze")}
                          >
                            Reactivate
                          </Button>
                        ) : (
                          <Button
                            variant="danger"
                            disabled={busyId === w.id || w.status === "CLOSED"}
                            onClick={() => toggle(w.id, "freeze")}
                          >
                            Freeze
                          </Button>
                        )}
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
