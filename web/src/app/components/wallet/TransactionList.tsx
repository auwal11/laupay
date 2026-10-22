import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Download, Receipt, Search, Smartphone, WalletCards, Wifi } from "lucide-react";
import { Link } from "react-router-dom";
import { StatusBadge } from "@app/components/ui/Badge";
import { Skeleton } from "@app/components/ui/Skeleton";
import { ErrorState } from "@app/components/ui/ErrorState";
import { EmptyState } from "@app/components/ui/EmptyState";
import { formatDateTime, formatNaira } from "@app/lib/format";
import { useTransactions } from "@app/hooks/useTransactions";
import { disputesService } from "@app/services/disputes";
import { DisputeDialog } from "@app/components/transactions/DisputeDialog";
import type { TransactionDispute } from "@app/types/disputes";
import type { Transaction } from "@app/types/wallet";

type Filter = "all" | "success" | "pending" | "processing" | "failed" | "refunded" | "unknown" | "airtime" | "data" | "wallet" | "bill_payment";

export function TransactionList({ limit }: { limit?: number }) {
  const state = useTransactions();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [range, setRange] = useState("all");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [disputes, setDisputes] = useState<TransactionDispute[]>([]);

  useEffect(() => {
    void disputesService.list().then((result) => { if (result.ok) setDisputes(result.data); });
  }, []);

  const filteredRows = useMemo(() => {
    if (state.status !== "success") return [];
    const normalized = query.trim().toLowerCase();
    const cutoff = range === "all" ? 0 : Date.now() - Number(range) * 86400000;
    return state.data.filter((txn) => {
      const text = `${txn.reference} ${txn.description} ${txn.network ?? ""} ${txn.counterparty ?? ""}`.toLowerCase();
      const statusMatch = filter === "all" || filter === txn.status;
      const typeMatch = filter === "wallet"
        ? ["wallet_funding", "wallet_debit", "reversal"].includes(txn.type)
        : filter === "all" || filter === txn.status || filter === txn.type;
      return (!normalized || text.includes(normalized)) && (filter === "all" ? true : statusMatch || typeMatch) && new Date(txn.createdAt).getTime() >= cutoff;
    }).slice(0, limit ?? state.data.length);
  }, [filter, limit, query, range, state]);

  if (state.status === "loading") return <div className="flex flex-col gap-2">{Array.from({ length: limit ? 3 : 6 }).map((_, i) => <Skeleton key={i} className="h-[88px] w-full" />)}</div>;
  if (state.status === "error") return <ErrorState error={state.error} />;
  if (state.status === "empty") return <EmptyState title="No transactions yet" description="Your airtime, data, and wallet activity will show up here once you make your first purchase." />;
  if (state.status !== "success") return null;

  const summaryRows = limit ? state.data : filteredRows;
  const credit = summaryRows.filter((txn) => txn.status === "success" && txn.direction === "credit").reduce((sum, txn) => sum + Number(txn.amount), 0);
  const debit = summaryRows.filter((txn) => txn.status === "success" && txn.direction !== "credit").reduce((sum, txn) => sum + Number(txn.amount), 0);

  return <div className="flex flex-col gap-4">
    {!limit && <>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-laupay-border bg-white px-3 py-2.5 shadow-card sm:px-4">
        <div className="grid min-w-0 flex-1 grid-cols-3 divide-x divide-laupay-border">
          <Summary label="Transactions" value={String(summaryRows.length)} />
          <Summary label="Credited" value={formatNaira(String(credit))} tone="credit" />
          <Summary label="Debited" value={formatNaira(String(debit))} tone="debit" />
        </div>
        <button type="button" onClick={() => downloadCsv(summaryRows)} className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-laupay-border px-3 py-2 text-xs font-semibold text-laupay-indigo hover:border-laupay-indigo sm:inline-flex" aria-label="Download transaction history">
          <Download size={14} /> Export
        </button>
      </div>
      <div className="rounded-xl border border-laupay-border bg-white p-3 shadow-card">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <label className="relative min-w-0"><Search size={16} className="absolute left-3 top-2.5 text-laupay-ink-muted" /><span className="sr-only">Search transactions</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference, service or recipient" className="h-10 w-full rounded-lg border border-laupay-border py-2 pl-9 pr-3 text-sm outline-none focus:border-laupay-indigo focus:ring-2 focus:ring-laupay-indigo/10" /></label>
          <select aria-label="Filter by status or type" value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="h-10 min-w-0 rounded-lg border border-laupay-border bg-white px-2.5 text-sm outline-none focus:border-laupay-indigo"><option value="all">All transactions</option><optgroup label="Status"><option value="success">Successful</option><option value="pending">Pending</option><option value="processing">Processing</option><option value="failed">Failed</option><option value="refunded">Refunded</option></optgroup><optgroup label="Type"><option value="airtime">Airtime</option><option value="data">Data</option><option value="wallet">Wallet</option><option value="bill_payment">Bills</option></optgroup></select>
          <select aria-label="Date range" value={range} onChange={(event) => setRange(event.target.value)} className="h-10 min-w-0 rounded-lg border border-laupay-border bg-white px-2.5 text-sm outline-none focus:border-laupay-indigo"><option value="all">All dates</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select>
          <button type="button" onClick={() => downloadCsv(filteredRows)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-laupay-border px-3 text-xs font-semibold text-laupay-indigo hover:border-laupay-indigo sm:hidden"><Download size={14} /> Export</button>
        </div>
      </div>
    </>}
    {filteredRows.length === 0 ? <EmptyState title="No matching transactions" description="Try a different search or filter." /> : <div className="overflow-hidden rounded-xl border border-laupay-border bg-white shadow-card"><ul className="divide-y divide-laupay-border">{filteredRows.map((txn) => <Row key={txn.id} txn={txn} dispute={disputes.find((item) => item.ledgerEntryId === txn.id)} onDispute={() => setSelected(txn)} />)}</ul></div>}
    {selected && <DisputeDialog transaction={selected} onClose={() => setSelected(null)} onCreated={(dispute) => { setDisputes((current) => [...current, dispute]); setSelected(null); }} />}
  </div>;
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: "credit" | "debit" }) {
  return <div className="min-w-0 px-2 first:pl-0 last:pr-0 sm:px-4"><p className="truncate text-[10px] font-semibold uppercase tracking-wide text-laupay-ink-muted sm:text-[11px]">{label}</p><p className={`mt-1 truncate text-sm font-semibold tabular-nums sm:text-base ${tone === "credit" ? "text-laupay-success" : tone === "debit" ? "text-laupay-ink" : "text-laupay-indigo"}`}>{value}</p></div>;
}

function Row({ txn, dispute, onDispute }: { txn: Transaction; dispute?: TransactionDispute; onDispute: () => void }) {
  const isCredit = txn.direction === "credit";
  const Icon = txn.type === "airtime" ? Smartphone : txn.type === "data" ? Wifi : txn.type === "wallet_funding" ? WalletCards : isCredit ? ArrowDownLeft : ArrowUpRight;
  const ageMinutes = (Date.now() - new Date(txn.createdAt).getTime()) / 60000;
  const disputeAllowed = txn.status === "failed" || ((txn.status === "pending" || txn.status === "unknown" || txn.status === "processing") && ageMinutes >= 30);
  return <li className="group px-3 py-3 transition-colors hover:bg-laupay-surface-muted/40 sm:px-4"><div className="flex min-h-[64px] items-center gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isCredit ? "bg-laupay-success/10 text-laupay-success" : "bg-laupay-indigo/10 text-laupay-indigo"}`}><Icon size={18} aria-hidden="true" /></div><div className="min-w-0 flex-1"><Link to={`/app/transactions/${txn.id}`} className="block truncate text-sm font-semibold text-laupay-ink hover:text-laupay-indigo">{txn.description}</Link><p className="mt-0.5 truncate text-xs text-laupay-ink-muted">{[txn.network, txn.counterparty].filter(Boolean).join(" · ") || "LAUPAY wallet"} · {formatDateTime(txn.createdAt)}</p><div className="mt-1.5 flex items-center gap-2 text-[11px]"><Link to={`/app/receipt/${txn.id}`} className="inline-flex items-center gap-1 font-medium text-laupay-indigo hover:underline"><Receipt size={12} /> Receipt</Link>{disputeAllowed && <button type="button" onClick={onDispute} className="font-medium text-laupay-ink-muted hover:text-laupay-indigo hover:underline">{dispute ? `Case ${dispute.caseReference}` : "Dispute"}</button>}</div></div><div className="flex shrink-0 flex-col items-end gap-1.5"><span className={`text-sm font-semibold tabular-nums ${isCredit ? "text-laupay-success" : "text-laupay-ink"}`}>{isCredit ? "+" : "−"}{formatNaira(txn.amount)}</span><div className="flex items-center gap-1"><StatusBadge status={txn.status} /><ChevronRight size={15} className="text-laupay-ink-muted" aria-hidden="true" /></div></div></div></li>;
}

function downloadCsv(rows: Transaction[]) {
  const header = "Reference,Type,Description,Amount,Direction,Status,Date";
  const body = rows.map((txn) => [txn.reference, txn.type, txn.description, txn.amount, txn.direction ?? "debit", txn.status, txn.createdAt].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "laupay-transactions.csv"; link.click(); URL.revokeObjectURL(url);
}
