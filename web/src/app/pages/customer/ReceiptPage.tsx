import { useEffect, useState } from "react";
import { ArrowLeft, Check, Copy, Download, Printer, Share2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Card } from "@app/components/ui/Card";
import { StatusBadge } from "@app/components/ui/Badge";
import { Button } from "@app/components/ui/Button";
import { Skeleton } from "@app/components/ui/Skeleton";
import { ErrorState } from "@app/components/ui/ErrorState";
import { DisputeDialog } from "@app/components/transactions/DisputeDialog";
import { FlowMark } from "@/components/laupay/FlowMark";
import { formatDateTime, formatNaira } from "@app/lib/format";
import { wallet } from "@app/services";
import type { AsyncState } from "@app/types/common";
import type { TransactionDetail } from "@app/types/wallet";

export function ReceiptPage() {
  const { id = "" } = useParams(); const [state, setState] = useState<AsyncState<TransactionDetail>>({ status: "loading" }); const [copied, setCopied] = useState(false); const [disputeOpen, setDisputeOpen] = useState(false);
  useEffect(() => { let cancelled = false; wallet.getTransaction(id).then((result) => { if (!cancelled) setState(result.ok ? { status: "success", data: result.data } : { status: "error", error: result.error }); }); return () => { cancelled = true; }; }, [id]);
  if (state.status === "loading") return <Skeleton className="mx-auto h-[500px] w-full max-w-2xl" />;
  if (state.status === "error") return <ErrorState error={state.error} />;
  if (state.status !== "success") return null;
  const txn = state.data; const credit = txn.direction === "credit";
  async function copyReference() { await navigator.clipboard?.writeText(txn.reference); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  async function shareReceipt() { const text = `LAUPAY · ${txn.description} · ${formatNaira(txn.amount)} · ${txn.reference}`; if (navigator.share) await navigator.share({ title: "LAUPAY payment receipt", text }); else await copyReference(); }
  return <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 print:max-w-full"><Link to="/app/transactions" className="inline-flex items-center gap-2 text-sm font-medium text-laupay-indigo print:hidden"><ArrowLeft size={16} />Back to Transactions</Link><Card className="overflow-hidden p-0"><div className="border-b border-laupay-border bg-laupay-indigo px-5 py-6 text-white sm:px-8"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-2"><FlowMark size={26} inverse /><div><p className="font-display text-lg font-bold tracking-wide">LAUPAY</p><p className="mt-1 text-sm text-white/70">Ibrahim Lau Provision Shop</p></div></div><StatusBadge status={txn.status} /></div><p className="mt-8 text-sm text-white/70">Payment Receipt</p><p className="mt-2 break-words font-display text-4xl font-semibold tracking-tight">{credit ? "+" : "-"}{formatNaira(txn.amount)}</p><p className="mt-2 text-sm text-white/80">{txn.description}</p></div><div className="p-5 sm:p-8"><dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2"><Detail label="Reference" value={txn.reference} copy onCopy={() => void copyReference()} copied={copied} /><Detail label="Date and time" value={formatDateTime(txn.createdAt)} /><Detail label="Transaction type" value={txn.type.replace("_", " ")} /><Detail label="Direction" value={credit ? "Money credited" : "Money debited"} />{txn.network && <Detail label="Network / provider" value={txn.network} />}{txn.counterparty && <Detail label="Destination" value={txn.counterparty} />}{txn.providerReference && <Detail label="Provider reference" value={txn.providerReference} />}</dl>{txn.failureReason && <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-laupay-danger">{txn.failureReason}</p>}<div className="mt-8 grid gap-3 sm:grid-cols-2 print:hidden"><Button onClick={() => window.print()}><Download size={16} />Download Receipt</Button><Button variant="secondary" onClick={() => window.print()}><Printer size={16} />Print Receipt</Button><Button variant="secondary" onClick={() => void shareReceipt()}><Share2 size={16} />Share Receipt</Button><Button variant="secondary" onClick={() => setDisputeOpen(true)}>Dispute Transaction</Button></div></div></Card>{disputeOpen && <DisputeDialog transaction={txn} onClose={() => setDisputeOpen(false)} onCreated={() => setDisputeOpen(false)} />}</div>;
}
function Detail({ label, value, copy, onCopy, copied }: { label: string; value: string; copy?: boolean; onCopy?: () => void; copied?: boolean }) { return <div className="min-w-0"><dt className="text-xs font-medium uppercase tracking-wide text-laupay-ink-muted">{label}</dt><dd className="mt-1 flex items-start gap-2 break-words text-sm font-semibold capitalize text-laupay-ink">{value}{copy && <button type="button" onClick={onCopy} aria-label="Copy transaction reference" className="shrink-0 rounded p-1 text-laupay-indigo hover:bg-laupay-surface-muted">{copied ? <Check size={15} /> : <Copy size={15} />}</button>}</dd></div>; }
