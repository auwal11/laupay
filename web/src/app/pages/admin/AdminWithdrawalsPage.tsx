import { useState } from "react";
import { Link } from "react-router-dom";
import { adminService } from "@app/admin/services";
import { LoadingRows, PageHeader, StatusBadge, useAsync } from "@app/admin/ui";
import { formatNaira } from "@app/lib/format";

export function AdminWithdrawalsPage() {
  const [status, setStatus] = useState("");
  const state = useAsync(() => adminService.withdrawals({ status: status || undefined }), [status]);
  return <div className="space-y-5">
    <PageHeader title="Withdrawals" description="Review held wallet withdrawals and verify payout settlement." />
    <div className="flex flex-wrap gap-2">
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-laupay-border bg-white px-3 py-2 text-sm text-laupay-ink">
        <option value="">All statuses</option><option>PENDING</option><option>APPROVED</option><option>PROCESSING</option><option>SUCCESSFUL</option><option>FAILED</option><option>REJECTED</option><option>REFUNDED</option>
      </select>
    </div>
    <div className="overflow-x-auto rounded-xl border border-laupay-border bg-white">
      <table className="min-w-[850px] w-full text-left text-sm"><thead className="border-b border-laupay-border bg-laupay-surface-muted text-xs uppercase tracking-wide text-laupay-ink-muted"><tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Destination</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Submitted</th></tr></thead>
        <tbody className="divide-y divide-laupay-border">{state.status === "loading" ? <tr><td colSpan={6} className="p-4"><LoadingRows rows={4} /></td></tr> : state.status === "error" ? <tr><td colSpan={6} className="px-4 py-10 text-center text-laupay-danger">{state.error.message}</td></tr> : state.data.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-laupay-ink-muted">No withdrawal requests found.</td></tr> : state.data.map((item) => <tr key={item.id} className="hover:bg-laupay-surface-muted/50"><td className="px-4 py-3"><p className="font-medium text-laupay-ink">{item.user?.fullName ?? "—"}</p><p className="text-xs text-laupay-ink-muted">{item.user?.email}</p></td><td className="px-4 py-3"><Link className="font-mono text-xs text-laupay-indigo hover:underline" to={`/admin/withdrawals/${item.id}`}>{item.reference}</Link></td><td className="px-4 py-3 font-semibold text-laupay-ink">{formatNaira(item.amount)}</td><td className="px-4 py-3"><p>{item.bankName}</p><p className="text-xs text-laupay-ink-muted">{item.accountNumber} · {item.accountName}</p></td><td className="px-4 py-3"><StatusBadge value={item.status} />{item.refundAmount !== "0.00" && <p className="mt-1 text-xs text-laupay-success">Refund {formatNaira(item.refundAmount ?? "0")}</p>}</td><td className="px-4 py-3 text-xs text-laupay-ink-muted">{new Date(item.createdAt).toLocaleString("en-NG")}</td></tr>)}</tbody>
      </table>
    </div>
  </div>;
}
