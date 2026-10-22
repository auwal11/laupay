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

const STATUS_LABEL: Record<string, string> = { success: "Successful", failed: "Failed", pending: "Pending", processing: "Processing", refunded: "Refunded", unknown: "Pending", cancelled: "Cancelled", created: "Created" };
const STATUS_COLOR: Record<string, string> = { success: "#16845B", failed: "#C43D4B", pending: "#B7791F", processing: "#B7791F", refunded: "#B7791F", unknown: "#B7791F", cancelled: "#737B91", created: "#737B91" };

export function ReceiptPage() {
  const { id = "" } = useParams();
  const [state, setState] = useState<AsyncState<TransactionDetail>>({ status: "loading" });
  const [copied, setCopied] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  useEffect(() => { let cancelled = false; void wallet.getTransaction(id).then((result) => { if (!cancelled) setState(result.ok ? { status: "success", data: result.data } : { status: "error", error: result.error }); }); return () => { cancelled = true; }; }, [id]);
  if (state.status === "loading") return <Skeleton className="mx-auto h-[500px] w-full max-w-2xl" />;
  if (state.status === "error") return <ErrorState error={state.error} />;
  if (state.status !== "success") return null;

  const txn = state.data;
  const credit = txn.direction === "credit";
  const statusLabel = STATUS_LABEL[txn.status] ?? txn.status;
  const statusColor = STATUS_COLOR[txn.status] ?? "#737B91";
  const typeLabel = titleCase(txn.type.replaceAll("_", " "));

  async function copyReference() { await navigator.clipboard?.writeText(txn.reference); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  async function shareReceipt() { const text = `LAUPAY · ${txn.description} · ${formatNaira(txn.amount)} · ${txn.reference}`; if (navigator.share) await navigator.share({ title: "LAUPAY payment receipt", text }); else await copyReference(); }
  function downloadReceipt() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { setDownloadNotice("Allow pop-ups to save your receipt as a PDF."); return; }
    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(buildPrintableReceipt(txn, credit));
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 350);
    setDownloadNotice("Receipt opened for saving or printing as PDF.");
  }

  return <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 print:max-w-full">
    <Link to="/app/transactions" className="inline-flex items-center gap-2 text-sm font-medium text-laupay-indigo print:hidden"><ArrowLeft size={16} />Back to Transactions</Link>
    {downloadNotice && <p role="status" className="rounded-lg border border-laupay-amber/40 bg-laupay-amber/10 px-3 py-2 text-sm text-laupay-ink print:hidden">{downloadNotice}</p>}
    <Card className="overflow-hidden p-0 print:rounded-none print:border-0 print:shadow-none">
      <div className="relative overflow-hidden bg-laupay-indigo px-5 py-6 text-white sm:px-8 sm:py-7 print:px-8 print:py-7">
        <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full border border-laupay-amber/20" aria-hidden="true" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5"><FlowMark size={30} inverse /><div><p className="font-display text-xl font-bold tracking-wide">LAUPAY</p><p className="mt-0.5 text-xs text-white/65">Ibrahim Lau Provision Shop</p></div></div>
          <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: statusColor, backgroundColor: "#fff" }}>{statusLabel}</span>
        </div>
        <div className="relative mt-8"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-laupay-amber">Payment receipt</p><p className="mt-2 break-words font-display text-4xl font-semibold tracking-tight sm:text-5xl">{credit ? "+" : "−"}{formatNaira(txn.amount)}</p><p className="mt-2 text-sm text-white/80">{typeLabel}</p><p className="mt-1 text-xs text-white/60">Official record of your transaction</p></div>
      </div>
      <div className="p-5 sm:p-8">
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <Detail label="Transaction reference" value={txn.reference} copy onCopy={() => void copyReference()} copied={copied} />
          <Detail label="Date and time" value={formatDateTime(txn.createdAt)} />
          <Detail label="Transaction type" value={typeLabel} />
          <Detail label="Status" value={statusLabel} />
          <Detail label="Amount" value={`${credit ? "+" : "−"}${formatNaira(txn.amount)}`} />
          <Detail label="Direction" value={credit ? "Money credited" : "Money debited"} />
          {txn.network && <Detail label="Network / provider" value={txn.network} />}
          {txn.counterparty && <Detail label="Destination" value={txn.counterparty} />}
          {txn.providerReference && <Detail label="Provider reference" value={txn.providerReference} />}
        </dl>
        {txn.failureReason && <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-laupay-danger">{txn.failureReason}</p>}
        <div className="mt-8 border-t border-laupay-border pt-5 text-center"><p className="text-sm font-medium text-laupay-ink">Thank you for using LAUPAY.</p><p className="mt-1 text-xs text-laupay-ink-muted">Ibrahim Lau Provision Shop</p><div className="mx-auto mt-4 h-1 w-20 rounded-full bg-laupay-amber" /></div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 print:hidden"><Button onClick={downloadReceipt}><Download size={16} />Save as PDF</Button><Button variant="secondary" onClick={() => window.print()}><Printer size={16} />Print Receipt</Button><Button variant="secondary" onClick={() => void shareReceipt()}><Share2 size={16} />Share Receipt</Button><Button variant="secondary" onClick={() => setDisputeOpen(true)}>Dispute Transaction</Button></div>
      </div>
    </Card>
    {disputeOpen && <DisputeDialog transaction={txn} onClose={() => setDisputeOpen(false)} onCreated={() => setDisputeOpen(false)} />}
  </div>;
}

function titleCase(value: string) { return value.replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character); }
function printableRow(label: string, value?: string) { return value ? `<div class="detail"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>` : ""; }

function buildPrintableReceipt(txn: TransactionDetail, credit: boolean) {
  const status = STATUS_LABEL[txn.status] ?? txn.status;
  const color = STATUS_COLOR[txn.status] ?? "#737B91";
  const type = titleCase(txn.type.replaceAll("_", " "));
  const amount = `${credit ? "+" : "−"}${formatNaira(txn.amount)}`;
  const logo = `<svg width="34" height="34" viewBox="0 0 32 32" aria-label="LAUPAY logo"><path d="M8 7v14c0 4 2.5 6 6.5 6H21" fill="none" stroke="#fff" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 7h8.5c4 0 5.5 2.5 5.5 6v8c0 4-2.5 6-6.5 6H15" fill="none" stroke="#F4B33F" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>LAUPAY-Receipt-${escapeHtml(txn.reference)}</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;background:#f5f7fc;color:#17194b;font-family:Arial,"Helvetica Neue",sans-serif;font-size:15px;line-height:1.45}.receipt{max-width:720px;margin:24px auto;background:#fff;border:1px solid #e4e8f1;border-radius:18px;overflow:hidden;box-shadow:0 12px 35px rgba(23,25,75,.1)}.header{position:relative;background:#19194b;color:#fff;padding:30px 34px 34px;border-bottom:5px solid #f4b33f}.brand{display:flex;align-items:center;gap:10px}.brand-name{font-size:22px;font-weight:800;letter-spacing:.08em}.legal{margin-top:2px;color:#c9cbe0;font-size:12px}.eyebrow{margin:30px 0 7px;color:#f4b33f;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}.amount{margin:0;font-size:44px;line-height:1.08;letter-spacing:-.03em}.type{margin:10px 0 0;color:#eef0fa;font-size:16px}.subtitle{margin:4px 0 0;color:#bfc2d6;font-size:12px}.body{padding:30px 34px 28px}.status{display:inline-block;margin-bottom:22px;border-radius:999px;background:${color};color:#fff;padding:6px 12px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.details{border-top:1px solid #e4e8f1}.detail{display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid #e4e8f1;padding:14px 0}.detail span{color:#737b91}.detail strong{max-width: sixty%;text-align:right;overflow-wrap:anywhere;color:#17194b}.footer{border-top:1px solid #e4e8f1;padding:22px 34px 28px;text-align:center;color:#737b91;font-size:12px}.thanks{color:#17194b;font-size:14px;font-weight:700}.accent{height:4px;width:82px;margin:14px auto 0;border-radius:99px;background:#f4b33f}@media(max-width:600px){body{background:#fff}.receipt{margin:0;border:0;border-radius:0;box-shadow:none}.header{padding:25px 22px 28px}.body{padding:25px 22px}.footer{padding:20px 22px 25px}.amount{font-size:38px}.detail{gap:14px}.detail strong{max-width:58%}}@media print{body{background:#fff;font-size:14px}.receipt{margin:0;max-width:none;border:0;border-radius:0;box-shadow:none}.header{break-inside:avoid}.body{padding-top:24px}.footer{break-inside:avoid}}</style></head><body><main class="receipt"><header class="header"><div class="brand">${logo}<div><div class="brand-name">LAUPAY</div><div class="legal">Ibrahim Lau Provision Shop</div></div></div><div class="eyebrow">Payment receipt</div><h1 class="amount">${escapeHtml(amount)}</h1><p class="type">${escapeHtml(type)}</p><p class="subtitle">Official record of your transaction</p></header><section class="body"><div class="status">${escapeHtml(status)}</div><div class="details">${printableRow("Transaction reference", txn.reference)}${printableRow("Date and time", formatDateTime(txn.createdAt))}${printableRow("Transaction type", type)}${printableRow("Amount", amount)}${printableRow("Direction", credit ? "Money credited" : "Money debited")}${printableRow("Network / provider", txn.network)}${printableRow("Destination", txn.counterparty)}${printableRow("Provider reference", txn.providerReference)}${printableRow("Status", status)}</div>${txn.failureReason ? `<p style="margin:22px 0 0;padding:12px 14px;border-radius:8px;background:#fdecef;color:#c43d4b">${escapeHtml(txn.failureReason)}</p>` : ""}</section><footer class="footer"><div class="thanks">Thank you for using LAUPAY.</div><div>Ibrahim Lau Provision Shop</div><div class="accent"></div></footer></main><script>window.addEventListener('afterprint',()=>window.close());</script></body></html>`;
}

function Detail({ label, value, copy, onCopy, copied }: { label: string; value: string; copy?: boolean; onCopy?: () => void; copied?: boolean }) { return <div className="min-w-0"><dt className="text-[11px] font-semibold uppercase tracking-wide text-laupay-ink-muted">{label}</dt><dd className="mt-1 flex items-start gap-2 break-words text-sm font-semibold text-laupay-ink">{value}{copy && <button type="button" onClick={onCopy} aria-label="Copy transaction reference" className="shrink-0 rounded p-1 text-laupay-indigo hover:bg-laupay-surface-muted">{copied ? <Check size={15} /> : <Copy size={15} />}</button>}</dd></div>; }
