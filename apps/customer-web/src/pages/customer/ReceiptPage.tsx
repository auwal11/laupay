import { useEffect, useState } from "react";
import { Download, Share2, Copy, Check } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatDateTime, formatNaira } from "@/lib/format";
import { wallet } from "@/services";
import type { AsyncState } from "@/types/common";
import type { TransactionDetail } from "@/types/wallet";

export function ReceiptPage() {
  const { id = "" } = useParams(); const [state, setState] = useState<AsyncState<TransactionDetail>>({ status: "loading" }); const [copied, setCopied] = useState(false);
  useEffect(() => { let cancelled = false; wallet.getTransaction(id).then((result) => { if (!cancelled) setState(result.ok ? { status: "success", data: result.data } : { status: "error", error: result.error }); }); return () => { cancelled = true; }; }, [id]);
  if (state.status === "loading") return <Skeleton className="mx-auto h-96 w-full max-w-sm" />;
  if (state.status === "error") return <ErrorState error={state.error} />;
  if (state.status !== "success") return null;
  const txn = state.data;
  if (txn.status !== "success") return <div className="mx-auto max-w-sm"><Card><p className="font-semibold text-laupay-danger">Transaction not successful</p><p className="mt-2 text-sm text-laupay-ink-muted">This transaction is {txn.status}. A successful receipt is only available after backend confirmation.</p><Link to="/app/transactions" className="mt-5 inline-block text-sm font-medium text-laupay-indigo">Back to transactions</Link></Card></div>;
  async function shareReceipt() { const text = `LAUPAY receipt ${txn.reference} · ${formatNaira(txn.amount)} · ${txn.description}`; if (navigator.share) await navigator.share({ title: "LAUPAY receipt", text }); else await navigator.clipboard?.writeText(text); }
  async function copyReference() { await navigator.clipboard?.writeText(txn.reference); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  function downloadReceipt() { const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="560"><rect width="100%" height="100%" fill="#fff"/><text x="40" y="70" font-family="Arial" font-size="32" font-weight="700" fill="#171A4A">LAUPAY</text><text x="40" y="105" font-family="Arial" font-size="18" fill="#5B5E80">${txn.description}</text><text x="40" y="180" font-family="Arial" font-size="48" font-weight="700" fill="#171A4A">${formatNaira(txn.amount)}</text><text x="40" y="240" font-family="Arial" font-size="20" fill="#171A4A">Status: Successful</text><text x="40" y="290" font-family="Arial" font-size="18" fill="#5B5E80">Reference: ${txn.reference}</text><text x="40" y="340" font-family="Arial" font-size="18" fill="#5B5E80">${formatDateTime(txn.createdAt)}</text><text x="40" y="500" font-family="Arial" font-size="16" fill="#5B5E80">LAUPAY · Ibrahim Lau Provision Shop</text></svg>`; const link = document.createElement("a"); link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; link.download = `laupay-receipt-${txn.reference}.svg`; link.click(); }
  return <div className="mx-auto flex max-w-sm flex-col gap-4 print:max-w-full"><Card className="text-center"><p className="font-display text-base font-semibold text-laupay-indigo">LAUPAY</p><p className="mt-1 text-xs text-laupay-ink-muted">Ibrahim Lau Provision Shop · Payment receipt</p><div className="my-5 flex justify-center"><StatusBadge status="success" /></div><p className="font-display text-3xl font-semibold text-laupay-ink">{formatNaira(txn.amount)}</p><p className="mt-1 text-sm text-laupay-ink-muted">{txn.description}</p><dl className="mt-6 flex flex-col gap-2.5 border-t border-dashed border-laupay-border pt-5 text-left text-sm"><Row label="Reference" value={txn.reference} />{txn.providerReference && <Row label="Provider reference" value={txn.providerReference} />}<Row label="Date" value={formatDateTime(txn.createdAt)} /></dl></Card><div className="grid grid-cols-3 gap-2 print:hidden"><Button variant="secondary" onClick={() => void shareReceipt()}><Share2 size={16} />Share</Button><Button variant="secondary" onClick={downloadReceipt}><Download size={16} />Download</Button><Button variant="secondary" onClick={() => void copyReference()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Reference"}</Button></div><div className="flex flex-col gap-2 print:hidden"><Button variant="ghost" fullWidth onClick={() => window.print()}>Print receipt</Button><Link to="/app/transactions" className="rounded-md border border-laupay-border px-4 py-2.5 text-center text-sm font-medium text-laupay-ink hover:bg-laupay-surface-muted">Done</Link></div></div>;
}

function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between"><dt className="text-laupay-ink-muted">{label}</dt><dd className="font-medium text-laupay-ink">{value}</dd></div>; }
