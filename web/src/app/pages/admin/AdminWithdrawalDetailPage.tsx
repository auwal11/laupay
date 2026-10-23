import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminService } from "@app/admin/services";
import { Button } from "@app/components/ui/Button";
import { formatNaira } from "@app/lib/format";
import { PageHeader, StatusBadge, useAsync } from "@app/admin/ui";

type Action = "approve" | "process" | "successful" | "failed" | "reject" | "refund";

export function AdminWithdrawalDetailPage() {
  const { id = "" } = useParams();
  const state = useAsync(() => adminService.withdrawal(id), [id]);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [providerReference, setProviderReference] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function begin(nextAction: Action) {
    setAction(nextAction); setReason(""); setProviderReference(""); setEvidence(""); setError(null);
  }

  async function submitAction() {
    if (!action) return;
    if (reason.trim().length < 3) { setError("Enter a clear reason before continuing."); return; }
    if (action === "successful" && (!providerReference.trim() || !evidence.trim())) { setError("Provider reference and verification evidence are required before marking successful."); return; }
    setBusy(true); setError(null);
    const body: Record<string, string> = { reason: reason.trim() };
    // The API intentionally rejects fields that do not belong to an action.
    // Provider evidence is only valid when confirming a verified payout.
    if (action === "successful") {
      body.providerReference = providerReference.trim();
      body.evidence = evidence.trim();
    }
    const result = await adminService.withdrawalAction(id, action, body);
    setBusy(false);
    if (!result.ok) { setError(result.error.message); return; }
    setAction(null); setReason(""); state.reload();
  }

  if (state.status === "loading") return <p className="text-sm text-laupay-ink-muted">Loading withdrawal…</p>;
  if (state.status === "error") return <p className="text-sm text-laupay-danger">{state.error.message}</p>;
  const item = state.data;
  return <div className="space-y-5">
    <Link to="/admin/withdrawals" className="text-sm font-medium text-laupay-indigo hover:underline">← Withdrawals</Link>
    <PageHeader title={item.reference} description="Approval authorizes processing; only verified evidence can confirm settlement." />
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="space-y-5">
        <div className="rounded-xl border border-laupay-border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-laupay-ink-muted">Amount</p><p className="mt-1 text-3xl font-semibold text-laupay-ink">{formatNaira(item.amount)}</p></div><StatusBadge value={item.status} /></div><dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-laupay-ink-muted">User</dt><dd className="font-medium">{item.user?.fullName} · {item.user?.email}</dd></div><div><dt className="text-laupay-ink-muted">Destination</dt><dd className="font-medium">{item.bankName} · {item.accountNumber}</dd></div><div><dt className="text-laupay-ink-muted">Account name</dt><dd className="font-medium">{item.accountName}</dd></div><div><dt className="text-laupay-ink-muted">Provider reference</dt><dd className="font-mono text-xs">{item.providerReference ?? "Not settled"}</dd></div></dl></div>
        <div className="rounded-xl border border-laupay-border bg-white p-5"><h2 className="font-semibold text-laupay-ink">Status timeline</h2><ol className="mt-4 space-y-3">{item.events.map((event) => <li key={`${event.createdAt}-${event.action}`} className="border-l-2 border-laupay-amber pl-3"><p className="text-sm font-medium">{event.action} · {event.toStatus}</p><p className="text-xs text-laupay-ink-muted">{event.reason} · {new Date(event.createdAt).toLocaleString("en-NG")}</p></li>)}</ol></div>
      </section>
      <aside className="rounded-xl border border-laupay-border bg-white p-5"><h2 className="font-semibold text-laupay-ink">Admin actions</h2><p className="mt-1 text-xs leading-relaxed text-laupay-ink-muted">Enter the reason once. Every action is validated by the backend and written to the audit trail.</p>
        {!action ? <div className="mt-4 grid gap-2">{item.status === "PENDING" && <Button disabled={busy} onClick={() => begin("approve")}>Approve for processing</Button>}{item.status === "APPROVED" && <Button disabled={busy} onClick={() => begin("process")}>Start processing</Button>}{item.status === "PROCESSING" && <Button disabled={busy} onClick={() => begin("successful")}>Mark successful (verified)</Button>}{["APPROVED", "PROCESSING"].includes(item.status) && <Button variant="secondary" disabled={busy} onClick={() => begin("failed")}>Mark failed + refund</Button>}{item.status === "PENDING" && <Button variant="secondary" disabled={busy} onClick={() => begin("reject")}>Reject + release funds</Button>}{["SUCCESSFUL", "FAILED", "REVERSED"].includes(item.status) && <Button variant="secondary" disabled={busy} onClick={() => begin("refund")}>Issue wallet refund</Button>}</div> : <div className="mt-4 space-y-3"><p className="text-sm font-semibold text-laupay-ink">{actionLabel(action)}</p><label className="block text-xs font-semibold text-laupay-ink">Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} disabled={busy} placeholder="Why are you making this change?" className="mt-1.5 w-full rounded-lg border border-laupay-border px-3 py-2 text-sm font-normal outline-none focus:border-laupay-indigo" /></label>{action === "successful" && <><label className="block text-xs font-semibold text-laupay-ink">Provider/payment reference<input value={providerReference} onChange={(event) => setProviderReference(event.target.value)} disabled={busy} placeholder="Verified provider reference" className="mt-1.5 h-10 w-full rounded-lg border border-laupay-border px-3 text-sm font-normal outline-none focus:border-laupay-indigo" /></label><label className="block text-xs font-semibold text-laupay-ink">Verification evidence<input value={evidence} onChange={(event) => setEvidence(event.target.value)} disabled={busy} placeholder="Provider confirmation or manual evidence" className="mt-1.5 h-10 w-full rounded-lg border border-laupay-border px-3 text-sm font-normal outline-none focus:border-laupay-indigo" /></label></>}{error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-laupay-danger">{error}</p>}<div className="flex gap-2"><Button variant="secondary" disabled={busy} onClick={() => setAction(null)}>Cancel</Button><Button disabled={busy} loading={busy} onClick={() => void submitAction()}>{busy ? "Processing…" : "Confirm action"}</Button></div></div>}
      </aside>
    </div>
  </div>;
}

function actionLabel(action: Action) { return ({ approve: "Approve withdrawal", process: "Start processing", successful: "Confirm successful payout", failed: "Mark failed and refund", reject: "Reject and release funds", refund: "Issue wallet refund" })[action]; }
