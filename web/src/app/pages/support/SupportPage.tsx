import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LifeBuoy, Send } from "lucide-react";
import { useAuth } from "@app/context/AuthContext";
import { supportService, type SupportTicket } from "@app/services/support";
import { Button } from "@app/components/ui/Button";
import { Input } from "@app/components/ui/Input";
import { Card } from "@app/components/ui/Card";

const categories = [["LOGIN", "Cannot log in"], ["REGISTRATION", "Registration problem"], ["OTP", "OTP or verification"], ["PASSWORD_RESET", "Password reset"], ["TECHNICAL_ERROR", "Technical error"], ["TRANSACTION", "Transaction"], ["WALLET", "Wallet"], ["WITHDRAWAL", "Withdrawal"], ["AIRTIME", "Airtime"], ["DATA", "Data"], ["OTHER", "Other"]];

export function SupportPage() {
  const { user } = useAuth();
  const location = useLocation();
  const entryState = location.state as { category?: string } | null;
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.fullName ?? "");
  const [category, setCategory] = useState(entryState?.category ?? "TECHNICAL_ERROR");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ticketNumber: string; trackingToken?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  useEffect(() => { if (user) void supportService.list().then((result) => { if (result.ok) setTickets(result.data); }); }, [user]);
  useEffect(() => { if (user) { setEmail(user.email); setName(user.fullName); } }, [user]);

  async function submit() {
    setError(null); setNotice(null);
    if (!email.trim() || !subject.trim() || description.trim().length < 10) { setError("Enter your email, a subject, and a clear description of at least 10 characters."); return; }
    setBusy(true);
    const result = await supportService.create({ contactEmail: email.trim(), contactName: name.trim() || undefined, category, subject: subject.trim(), description: description.trim(), errorCode: errorCode.trim() || undefined, sourcePage: location.pathname, sourceUrl: location.pathname }, Boolean(user));
    setBusy(false);
    if (!result.ok) { setError(result.error.message); return; }
    setNotice({ ticketNumber: result.data.ticketNumber, trackingToken: result.data.trackingToken });
    setSubject(""); setDescription(""); setErrorCode("");
    if (user) { const list = await supportService.list(); if (list.ok) setTickets(list.data); }
  }

  async function openTicket(ticket: SupportTicket) {
    const result = await supportService.detail(ticket.id);
    if (result.ok) setSelected(result.data);
  }

  async function sendReply() {
    if (!selected || reply.trim().length < 2) return;
    setBusy(true); const result = await supportService.reply(selected.id, reply.trim()); setBusy(false);
    if (result.ok) { setSelected(result.data); setReply(""); const list = await supportService.list(); if (list.ok) setTickets(list.data); }
    else setError(result.error.message);
  }

  return <div className="mx-auto w-full max-w-4xl space-y-5"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-laupay-amber">LAUPAY support</p><h1 className="mt-1 font-display text-2xl font-semibold text-laupay-ink">Help &amp; Support</h1><p className="mt-1 text-sm text-laupay-ink-muted">Tell us what happened and our support team will review it.</p></div>
    {notice && <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"><p className="font-semibold">Your issue has been submitted successfully.</p><p className="mt-1">Ticket: <strong>{notice.ticketNumber}</strong>. Keep this reference for follow-up.</p>{notice.trackingToken && <p className="mt-1 text-xs">Your private tracking token is shown once: <span className="break-all font-mono">{notice.trackingToken}</span></p>}</div>}
    {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-laupay-danger">{error}</p>}
    <Card><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-laupay-indigo/10 text-laupay-indigo"><LifeBuoy size={20} /></span><div><h2 className="font-semibold text-laupay-ink">Report a technical issue</h2><p className="text-xs text-laupay-ink-muted">Do not include passwords, OTPs, PINs or access tokens.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={Boolean(user)} required /><Input label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} disabled={Boolean(user)} /><label className="flex flex-col gap-1.5 text-sm font-medium text-laupay-ink"><span>Category</span><select value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 rounded-lg border border-laupay-border bg-white px-3 outline-none focus:border-laupay-indigo">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><Input label="Error code (optional)" value={errorCode} onChange={(e) => setErrorCode(e.target.value)} maxLength={80} placeholder="e.g. NETWORK_ERROR" /><Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} required /><label className="sm:col-span-2 flex flex-col gap-1.5 text-sm font-medium text-laupay-ink"><span>What happened?</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} rows={6} placeholder="Describe the problem and what you expected to happen." className="resize-y rounded-lg border border-laupay-border px-3 py-3 text-sm outline-none focus:border-laupay-indigo" required /></label></div><Button className="mt-4" onClick={() => void submit()} loading={busy}><Send size={16} /> {busy ? "Submitting…" : "Submit issue"}</Button><p className="mt-3 text-xs text-laupay-ink-muted">Support: <a className="text-laupay-indigo underline" href="mailto:support.laupay@gmail.com">support.laupay@gmail.com</a></p></Card>
    {user && <Card><h2 className="font-semibold text-laupay-ink">My support tickets</h2>{tickets.length === 0 ? <p className="mt-3 text-sm text-laupay-ink-muted">No tickets yet.</p> : <div className="mt-3 divide-y divide-laupay-border">{tickets.map((ticket) => <button type="button" key={ticket.id} onClick={() => void openTicket(ticket)} className="flex w-full items-center justify-between gap-3 py-3 text-left"><span><span className="block text-sm font-semibold text-laupay-ink">{ticket.subject}</span><span className="text-xs text-laupay-ink-muted">{ticket.ticketNumber} · {new Date(ticket.createdAt).toLocaleString("en-NG")}</span></span><span className="rounded-full bg-laupay-indigo/10 px-2.5 py-1 text-xs font-semibold capitalize text-laupay-indigo">{ticket.status.replace("_", " ")}</span></button>)}</div>}</Card>}
    {selected && <Card><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-laupay-ink">{selected.ticketNumber}: {selected.subject}</h2><p className="mt-1 text-xs text-laupay-ink-muted">Status: {selected.status.replace("_", " ")}</p></div><button type="button" className="text-sm text-laupay-indigo" onClick={() => setSelected(null)}>Close</button></div><div className="mt-4 space-y-3">{selected.messages?.map((message) => <div key={message.id} className="rounded-lg bg-laupay-surface-muted p-3 text-sm"><p className="text-[11px] font-semibold uppercase text-laupay-ink-muted">{message.authorType === "admin" ? "LAUPAY Support" : "You"}</p><p className="mt-1 whitespace-pre-wrap">{message.body}</p></div>)}</div>{selected.status !== "closed" && <div className="mt-4 flex gap-2"><textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Add more information" className="min-w-0 flex-1 rounded-lg border border-laupay-border px-3 py-2 text-sm" /><Button onClick={() => void sendReply()} loading={busy}>Reply</Button></div>}{selected.resolutionSummary && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800"><strong>Resolution:</strong> {selected.resolutionSummary}</p>}</Card>}
    <p className="text-center text-xs text-laupay-ink-muted"><Link to={user ? "/app" : "/login"} className="text-laupay-indigo underline">Back</Link> · LAUPAY · Ibrahim Lau Provision Shop</p>
  </div>;
}
