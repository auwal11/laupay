import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { security } from "@/services";
import type { NotificationMetadata, SecurityNotification } from "@/types/security";
import { formatDateTime } from "@/lib/format";

const POLL_INTERVAL_MS = 7000;
const DETAILS: Array<[keyof NotificationMetadata, string]> = [
  ["alertType", "Type"], ["transactionReference", "Reference"], ["transactionId", "Transaction ID"],
  ["amount", "Amount"], ["currency", "Currency"], ["narrative", "Narrative"], ["status", "Status"],
  ["date", "Transaction date"], ["availableBalance", "Available balance"],
  ["originalTransactionId", "Original transaction ID"], ["originalReference", "Original reference"],
  ["orderId", "Order ID"], ["recipient", "Recipient"], ["service", "Service"],
];

export function NotificationBell() {
  const [items, setItems] = useState<SecurityNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<SecurityNotification | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const seenIds = useRef<Set<string> | null>(null);
  const refresh = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const [result, countResult] = await Promise.all([security.getNotifications(), security.getUnreadNotificationCount()]);
    if (!result.ok) return;
    const incoming = result.data;
    const known = seenIds.current;
    if (known) {
      const fresh = incoming.filter((item) => !known.has(item.id));
      const newest = fresh[0];
      if (newest) {
        setToast(newest);
        window.setTimeout(() => setToast((current) => current?.id === newest.id ? null : current), 5000);
      }
    }
    seenIds.current = new Set(incoming.map((item) => item.id));
    setItems(incoming);
    setUnreadCount(countResult.ok ? countResult.data.count : incoming.filter((item) => !item.readAt).length);
  }, []);

  useEffect(() => {
    void refresh(); // Initial results establish the baseline; they never toast.
    const timer = window.setInterval(() => { void refresh(); }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const unread = unreadCount;
  async function markRead(item: SecurityNotification) {
    if (item.readAt || busyId) return;
    setBusyId(item.id);
    const result = await security.markNotificationRead(item.id);
    setBusyId(null);
    if (result.ok) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
      setUnreadCount((count) => Math.max(0, count - 1));
    }
  }
  async function markAllRead() {
    if (!unread || busyAll) return;
    setBusyAll(true);
    const result = await security.markAllNotificationsRead();
    setBusyAll(false);
    if (result.ok) {
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      setUnreadCount(0);
    }
  }

  return <>
    <div className="relative">
      <button aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="relative rounded-md p-2 text-laupay-ink-muted hover:bg-laupay-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-laupay-indigo">
        <Bell size={18} aria-hidden="true" />{unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-laupay-amber" />}
      </button>
      {open && <section aria-label="Notifications inbox" className="absolute right-0 top-11 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-laupay-border bg-white p-3 shadow-xl">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-laupay-ink">Notifications</h2><button disabled={!unread || busyAll} className="text-xs text-laupay-indigo disabled:opacity-50" onClick={() => void markAllRead()}>{busyAll ? "Marking…" : "Mark all read"}</button></div>
        {items.length === 0 ? <p className="py-5 text-sm text-laupay-ink-muted">No notifications yet.</p> : <ul className="mt-2 max-h-[70vh] overflow-auto divide-y divide-laupay-border">{items.map((item) => <li key={item.id} className={`py-3 text-sm ${item.readAt ? "text-laupay-ink-muted" : "text-laupay-ink"}`}>
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold">{item.title}</p><p className="mt-0.5 whitespace-pre-wrap break-words">{item.body}</p></div>{!item.readAt && <button disabled={busyId === item.id} onClick={() => void markRead(item)} className="shrink-0 text-xs font-medium text-laupay-indigo disabled:opacity-50">{busyId === item.id ? "Saving…" : "Mark read"}</button>}</div>
          <p className="mt-1 text-xs text-laupay-ink-muted">{formatDateTime(item.createdAt)}</p><Metadata metadata={item.metadata} />
        </li>)}</ul>}
      </section>}
    </div>
    {toast && <div role="status" className="fixed bottom-5 right-5 z-[60] flex w-[min(24rem,calc(100vw-2.5rem))] items-start gap-3 rounded-lg border border-laupay-border bg-white p-4 shadow-xl">
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-laupay-indigo">New notification</p><p className="mt-1 text-sm font-semibold text-laupay-ink">{toast.title}</p><p className="mt-1 line-clamp-2 text-sm text-laupay-ink-muted">{toast.body}</p></div>
      <button aria-label="Dismiss notification" onClick={() => setToast(null)} className="text-laupay-ink-muted hover:text-laupay-ink"><X size={16} /></button>
    </div>}
  </>;
}

function Metadata({ metadata }: { metadata?: NotificationMetadata | null }) {
  if (!metadata) return null;
  const entries = DETAILS.flatMap(([key, label]) => {
    const value = metadata[key];
    return value !== undefined && value !== null && value !== "" && ["string", "number"].includes(typeof value)
      ? [[label, String(value)] as [string, string]] : [];
  });
  if (!entries.length) return null;
  return <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-laupay-surface-muted p-2 text-xs">
    {entries.map(([label, value]) => <div key={label} className="contents"><dt className="text-laupay-ink-muted">{label}</dt><dd className="break-all font-medium text-laupay-ink">{value}</dd></div>)}
  </dl>;
}
