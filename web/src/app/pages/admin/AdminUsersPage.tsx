import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { adminService } from "@app/admin/services";
import { useAdminAuth } from "@app/admin/AdminAuthContext";
import {
  LoadingRows,
  PageHeader,
  Pagination,
  RoleBadge,
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
import { Input } from "@app/components/ui/Input";
import { formatNaira } from "@app/lib/format";

export function AdminUsersPage() {
  const { session } = useAdminAuth();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [fundUser, setFundUser] = useState<{ id: string; name: string } | null>(null);
  const [fundAmount, setFundAmount] = useState("5000");
  const [fundBusy, setFundBusy] = useState(false);
  const [fundNotice, setFundNotice] = useState<string | null>(null);
  const [fundError, setFundError] = useState<string | null>(null);

  const [staffEmail, setStaffEmail] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState<"SUPPORT" | "FINANCE" | "VIEWER">("SUPPORT");
  const [staffReason, setStaffReason] = useState("");
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffResult, setStaffResult] = useState<{ email: string; role: string; temporaryPassword: string; warning: string } | null>(null);

  const state = useAsync(
    () => adminService.users({ search: search || undefined, role: role || undefined, status: status || undefined, page, pageSize: 20 }),
    [search, role, status, page],
  );

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  function openFund(user: { id: string; fullName: string }) {
    setFundUser({ id: user.id, name: user.fullName });
    setFundAmount("5000");
    setFundNotice(null);
    setFundError(null);
  }

  async function submitFund(e: FormEvent) {
    e.preventDefault();
    if (!fundUser) return;
    setFundBusy(true);
    setFundNotice(null);
    setFundError(null);
    const value = Number(fundAmount);
    const result = await adminService.creditTestFunds({
      userId: fundUser.id,
      amount: value,
      idempotencyKey: crypto.randomUUID(),
    });
    setFundBusy(false);
    if (!result.ok) {
      setFundError(result.error.message);
      return;
    }
    setFundNotice(
      result.data.wasAlreadyApplied
        ? "This credit was already applied."
        : `Funded ${fundUser.name} ${formatNaira(String(value))}. New balance: ${formatNaira(result.data.balanceAfter)}.`,
    );
    state.reload();
  }

  async function submitStaff(e: FormEvent) {
    e.preventDefault();
    setStaffBusy(true);
    setStaffError(null);
    setStaffResult(null);
    const result = await adminService.createStaff({
      email: staffEmail.trim().toLowerCase(),
      fullName: staffName.trim(),
      role: staffRole,
      reason: staffReason.trim(),
    });
    setStaffBusy(false);
    if (!result.ok) {
      setStaffError(result.error.message);
      return;
    }
    setStaffResult({
      email: result.data.user.email,
      role: result.data.user.role,
      temporaryPassword: result.data.temporaryPassword,
      warning: result.data.warning,
    });
    setStaffEmail("");
    setStaffName("");
    setStaffReason("");
    state.reload();
  }

  return (
    <div>
      <PageHeader title="Users" description="Every registered account and its wallet." />

      {session?.isSuperAdmin && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-laupay-ink">Create staff account</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-laupay-ink-muted">
                Create a restricted Support, Finance, or Viewer login. The generated password is shown once and is never stored in plain text.
              </p>
            </div>
            {staffResult && (
              <button type="button" onClick={() => setStaffResult(null)} className="text-xs font-medium text-laupay-ink-muted hover:underline">
                Hide credentials
              </button>
            )}
          </div>
          <form onSubmit={submitStaff} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input label="Full name" value={staffName} onChange={(e) => setStaffName(e.target.value)} autoComplete="name" required />
            <Input label="Email" type="email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} autoComplete="email" required />
            <label className="flex flex-col gap-1.5 text-sm font-medium text-laupay-ink">
              <span>Role</span>
              <select value={staffRole} onChange={(e) => setStaffRole(e.target.value as typeof staffRole)} className={selectClass}>
                <option value="SUPPORT">Support</option>
                <option value="FINANCE">Finance</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </label>
            <Input label="Reason" value={staffReason} onChange={(e) => setStaffReason(e.target.value)} minLength={5} maxLength={500} placeholder="Why is access needed?" required />
            <Button type="submit" loading={staffBusy} className="self-end">Create login</Button>
          </form>
          {staffError && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-laupay-danger">{staffError}</p>}
          {staffResult && (
            <div className="mt-4 rounded-lg border border-laupay-gold/50 bg-laupay-gold/10 p-4" role="status">
              <p className="text-sm font-semibold text-laupay-ink">Staff account created</p>
              <p className="mt-1 text-xs text-laupay-ink-muted">{staffResult.email} · {staffResult.role}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <code className="rounded-md bg-white px-3 py-2 text-sm font-semibold tracking-wide text-laupay-ink">{staffResult.temporaryPassword}</code>
                <Button type="button" variant="secondary" onClick={() => void navigator.clipboard?.writeText(staffResult.temporaryPassword)}>Copy temporary password</Button>
              </div>
              <p className="mt-2 text-xs leading-5 text-laupay-ink-muted">{staffResult.warning} Do not send it through an insecure public channel.</p>
            </div>
          )}
        </Card>
      )}

      {fundUser && (
        <Card className="mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-laupay-ink">Fund {fundUser.name}</h2>
            <button
              type="button"
              onClick={() => setFundUser(null)}
              className="text-xs font-medium text-laupay-ink-muted hover:underline"
            >
              Close
            </button>
          </div>
          <p className="mt-1 text-xs leading-5 text-laupay-ink-muted">
            Adds funds to this user's wallet and records an audit entry. Visible to the user as a
            test credit from Ibrahim Lau Provision Shop.
          </p>
          <form onSubmit={submitFund} className="mt-3 flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Input
                label="Amount (NGN)"
                type="number"
                min="1"
                step="0.01"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                required
              />
            </div>
            <Button type="submit" loading={fundBusy}>
              Credit test funds
            </Button>
          </form>
          {fundNotice && (
            <p role="status" className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs font-medium text-laupay-success">
              {fundNotice}
            </p>
          )}
          {fundError && (
            <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-laupay-danger">
              {fundError}
            </p>
          )}
        </Card>
      )}

      <form onSubmit={onSearch} className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label htmlFor="user-search" className="text-sm font-medium text-laupay-ink">
            Search
          </label>
          <input
            id="user-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Email, name or phone"
            className={selectClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="user-role" className="text-sm font-medium text-laupay-ink">
            Role
          </label>
          <select
            id="user-role"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="">All roles</option>
            <option value="CUSTOMER">Customer</option>
            <option value="AGENT">Agent</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPPORT">Support</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="user-status" className="text-sm font-medium text-laupay-ink">
            Status
          </label>
          <select
            id="user-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING_VERIFICATION">Pending verification</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="FROZEN">Frozen</option>
            <option value="CLOSED">Closed — can reopen</option>
          </select>
        </div>
        <Button type="submit">Search</Button>
      </form>

      {state.status === "loading" && <LoadingRows />}
      {state.status === "error" && <ErrorState error={state.error} onRetry={state.reload} />}
      {state.status === "success" && (
        <>
          {state.data.items.length === 0 ? (
            <EmptyState title="No users found" description="Try adjusting your filters." />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>User</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Balance</Th>
                    <Th>PIN</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {state.data.items.map((u) => (
                    <tr key={u.id} className="border-b border-laupay-border last:border-0">
                      <Td>
                        <span className="font-medium">{u.fullName}</span>
                        <span className="block text-xs text-laupay-ink-muted">{u.email}</span>
                      </Td>
                      <Td>
                        <RoleBadge value={u.role} />
                      </Td>
                      <Td>
                        <StatusBadge value={u.status} />
                      </Td>
                      <Td className="text-right font-medium">
                        {u.walletAccount ? formatNaira(u.walletAccount.balance) : "—"}
                      </Td>
                      <Td className="text-xs text-laupay-ink-muted">{u.hasPin ? "Set" : "Not set"}</Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openFund(u)}
                            className="text-xs font-medium text-laupay-indigo hover:underline"
                          >
                            Fund
                          </button>
                          <Link
                            to={`/admin/users/${u.id}`}
                            className="text-xs font-medium text-laupay-indigo hover:underline"
                          >
                            View
                          </Link>
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
    </div>
  );
}
