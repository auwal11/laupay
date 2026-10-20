import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { adminService } from "@app/admin/services";
import {
  LoadingRows,
  PageHeader,
  Pagination,
  ReasonDialog,
  StatusBadge,
  Td,
  Th,
  selectClass,
  useAsync,
} from "@app/admin/ui";
import { Input } from "@app/components/ui/Input";
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
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; action: "freeze" | "unfreeze"; name: string } | null>(null);
  const [adjust, setAdjust] = useState<{ id: string; name: string } | null>(null);
  const [adjustAction, setAdjustAction] = useState<"credit" | "debit">("credit");
  const [adjustAmount, setAdjustAmount] = useState("1000");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const float = useAsync(() => adminService.float(), []);

  const state = useAsync(
    () => adminService.wallets({ search: search || undefined, status: status || undefined, page, pageSize: 20 }),
    [search, status, page],
  );

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  async function toggle(reason: string) {
    if (!pending) return;
    setBusyId(pending.id);
    setError(null);
    setNotice(null);
    const result = await adminService.setWalletStatus(pending.id, pending.action, reason);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setPending(null);
    setNotice(`Wallet ${pending.action === "freeze" ? "frozen" : "reactivated"} for ${pending.name}.`);
    state.reload();
    float.reload();
  }

  async function submitAdjust(e: FormEvent) {
    e.preventDefault();
    if (!adjust) return;
    setAdjustBusy(true);
    setError(null);
    setNotice(null);
    const body = {
      userId: adjust.id,
      amount: Number(adjustAmount),
      reason: adjustReason.trim(),
      idempotencyKey: crypto.randomUUID(),
    };
    const result =
      adjustAction === "credit"
        ? await adminService.creditWallet(body)
        : await adminService.debitWallet(body);
    setAdjustBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice(
      `${adjustAction === "credit" ? "Credited" : "Debited"} ${formatNaira(adjustAmount)} ${adjustAction === "credit" ? "to" : "from"} ${adjust.name}. New balance: ${formatNaira(result.data.balanceAfter)}.`,
    );
    setAdjust(null);
    setAdjustReason("");
    state.reload();
    float.reload();
  }

  async function exportCsv() {
    setExporting(true);
    const err = await adminService.exportTransactionsCsv({
      search: search || undefined,
      walletId: undefined,
    });
    setExporting(false);
    if (err) setError(err.message);
  }

  return (
    <div>
      <PageHeader
        title="Wallets"
        description="Wallet balances and status across the platform."
        actions={
          <Button variant="secondary" loading={exporting} onClick={() => void exportCsv()}>
            Export transactions CSV
          </Button>
        }
      />

      {float.status === "success" && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-xs font-medium uppercase tracking-wide text-laupay-ink-muted">Customer float</p>
            <p className="mt-1 font-display text-xl font-semibold text-laupay-ink">
              {formatNaira(float.data.totalCustomerLiabilities)}
            </p>
            <p className="mt-1 text-xs text-laupay-ink-muted">{float.data.walletCount} wallets</p>
          </Card>
          {float.data.byOwnerType.map((row) => (
            <Card key={row.ownerType}>
              <p className="text-xs font-medium uppercase tracking-wide text-laupay-ink-muted">{row.ownerType}</p>
              <p className="mt-1 font-display text-xl font-semibold text-laupay-ink">{formatNaira(row.balance)}</p>
            </Card>
          ))}
        </div>
      )}

      {adjust && (
        <Card className="mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-laupay-ink">
              {adjustAction === "credit" ? "Credit" : "Debit"} {adjust.name}
            </h2>
            <button type="button" onClick={() => setAdjust(null)} className="text-xs font-medium text-laupay-ink-muted hover:underline">
              Close
            </button>
          </div>
          <form onSubmit={submitAdjust} className="mt-3 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-laupay-ink" htmlFor="adjust-action">Action</label>
              <select
                id="adjust-action"
                value={adjustAction}
                onChange={(e) => setAdjustAction(e.target.value as "credit" | "debit")}
                className={selectClass}
              >
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
              </select>
            </div>
            <div className="w-36">
              <Input
                label="Amount (NGN)"
                type="number"
                min="0.01"
                step="0.01"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                required
              />
            </div>
            <div className="min-w-[220px] flex-1">
              <Input
                label="Reason (required, audited)"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                required
              />
            </div>
            <Button type="submit" loading={adjustBusy} disabled={adjustReason.trim().length < 5}>
              {adjustAction === "credit" ? "Credit wallet" : "Debit wallet"}
            </Button>
          </form>
        </Card>
      )}

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

      {notice && (
        <p role="status" className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-laupay-success">
          {notice}
        </p>
      )}
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
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            disabled={busyId === w.id}
                            onClick={() => {
                              setAdjust({ id: w.ownerId, name: w.user?.fullName ?? w.ownerId });
                              setAdjustAction("credit");
                              setError(null);
                            }}
                          >
                            Adjust
                          </Button>
                          {w.status === "FROZEN" ? (
                            <Button
                              variant="secondary"
                              disabled={busyId === w.id}
                              onClick={() => setPending({ id: w.id, action: "unfreeze", name: w.user?.fullName ?? w.ownerId })}
                            >
                              Reactivate
                            </Button>
                          ) : (
                            <Button
                              variant="danger"
                              disabled={busyId === w.id || w.status === "CLOSED"}
                              onClick={() => setPending({ id: w.id, action: "freeze", name: w.user?.fullName ?? w.ownerId })}
                            >
                              Freeze
                            </Button>
                          )}
                        </div>
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

      <ReasonDialog
        open={pending !== null}
        title={pending ? `${pending.action === "freeze" ? "Freeze" : "Reactivate"} ${pending.name}'s wallet` : ""}
        description={
          pending?.action === "freeze"
            ? "Spending from this wallet will be blocked until reactivated."
            : "Spending will be allowed again on this wallet."
        }
        confirmLabel={pending?.action === "freeze" ? "Freeze wallet" : "Reactivate wallet"}
        danger={pending?.action === "freeze"}
        busy={busyId !== null}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => void toggle(reason)}
      />
    </div>
  );
}
