import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { ShieldCheck, UserRoundX } from "lucide-react";
import { adminService } from "@app/admin/services";
import { useAdminAuth } from "@app/admin/AdminAuthContext";
import {
  LoadingRows,
  PageHeader,
  Pagination,
  ReasonDialog,
  RoleBadge,
  StatusBadge,
  Td,
  Th,
  selectClass,
  useAsync,
} from "@app/admin/ui";
import type { AdminStaffRow } from "@app/admin/types";
import { Button } from "@app/components/ui/Button";
import { Card } from "@app/components/ui/Card";
import { EmptyState } from "@app/components/ui/EmptyState";
import { ErrorState } from "@app/components/ui/ErrorState";
import { Input } from "@app/components/ui/Input";
import { formatDateTime } from "@app/lib/format";

export function AdminStaffPage() {
  const { session } = useAdminAuth();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<AdminStaffRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const state = useAsync(
    () => adminService.staff({ search: search || undefined, role: role || undefined, status: status || undefined, page, pageSize: 20 }),
    [search, role, status, page],
  );

  if (!session?.isSuperAdmin) return <Navigate to="/admin" replace />;

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function revoke(reason: string) {
    if (!pending) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await adminService.revokeStaffAccess(pending.id, reason);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice(`Access to ${pending.fullName || pending.email} has been revoked. Their account is frozen and active sessions are invalidated.`);
    setPending(null);
    state.reload();
  }

  return (
    <div>
      <PageHeader
        title="Staff access"
        description="Review all project admin and staff accounts. Revoking access freezes the account and invalidates active sessions; its role and audit history are retained."
      />

      <Card className="mb-4">
        <form onSubmit={onSearch} className="grid gap-3 sm:grid-cols-[minmax(14rem,1fr)_12rem_12rem_auto] sm:items-end">
          <Input label="Search staff" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Name or email" />
          <label className="flex flex-col gap-1.5 text-sm font-medium text-laupay-ink">
            <span>Role</span>
            <select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} className={selectClass}>
              <option value="">All staff roles</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPPORT">Support</option>
              <option value="FINANCE">Finance</option>
              <option value="VIEWER">Viewer</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-laupay-ink">
            <span>Status</span>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className={selectClass}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="FROZEN">Frozen</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="CLOSED">Closed</option>
              <option value="PENDING_VERIFICATION">Pending verification</option>
            </select>
          </label>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </Card>

      {notice && <p role="status" className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-laupay-success">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-laupay-danger">{error}</p>}

      <Card className="overflow-hidden p-0">
        {state.status === "loading" ? (
          <div className="p-5"><LoadingRows /></div>
        ) : state.status === "error" ? (
          <div className="p-5"><ErrorState error={state.error} onRetry={state.reload} /></div>
        ) : state.data.items.length === 0 ? (
          <div className="p-5"><EmptyState title="No staff accounts found" description="Try changing the filters, or clear the search." /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead><tr><Th>Staff member</Th><Th>Role</Th><Th>Status</Th><Th>Created</Th><Th className="text-right">Access</Th></tr></thead>
                <tbody>
                  {state.data.items.map((staff) => (
                    <tr key={staff.id}>
                      <Td>
                        <p className="font-medium">{staff.fullName || "—"}</p>
                        <p className="mt-0.5 text-xs text-laupay-ink-muted">{staff.email}</p>
                      </Td>
                      <Td><RoleBadge value={staff.role} /></Td>
                      <Td><StatusBadge value={staff.status} /></Td>
                      <Td>{formatDateTime(staff.createdAt)}</Td>
                      <Td className="text-right">
                        {staff.isSuperAdmin ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-laupay-surface-muted px-2.5 py-2 text-xs font-semibold text-laupay-ink-muted" title="The configured Super Admin is protected from revocation">
                            <ShieldCheck size={15} aria-hidden="true" /> Protected
                          </span>
                        ) : staff.status === "FROZEN" ? (
                          <Link to={`/admin/users/${staff.id}`} className="text-xs font-semibold text-laupay-indigo-soft hover:underline">Access revoked · Review</Link>
                        ) : staff.status === "CLOSED" ? (
                          <span className="text-xs font-medium text-laupay-ink-muted">Closed</span>
                        ) : (
                          <Button type="button" variant="danger" className="px-3 py-2" onClick={() => { setPending(staff); setError(null); setNotice(null); }}>
                            <UserRoundX size={15} aria-hidden="true" /> Revoke access
                          </Button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination page={state.data.page} pageSize={state.data.pageSize} total={state.data.total} onPage={setPage} />
            </div>
          </>
        )}
      </Card>

      <ReasonDialog
        open={Boolean(pending)}
        title="Revoke staff access?"
        description={pending ? `This freezes ${pending.fullName || pending.email}, blocks sign-in, and invalidates their active sessions. The staff role and audit history remain available for traceability. The configured Super Admin cannot be revoked.` : undefined}
        confirmLabel="Revoke access"
        danger
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => void revoke(reason)}
      />
    </div>
  );
}
