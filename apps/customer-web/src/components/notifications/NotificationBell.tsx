import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { security } from "@/services";
import type { SecurityNotification } from "@/types/security";

export function NotificationBell() {
  const [items, setItems] = useState<SecurityNotification[]>([]); const [open, setOpen] = useState(false);
  useEffect(() => { security.getNotifications().then((result) => { if (result.ok) setItems(result.data); }); }, []);
  const unread = items.filter((item) => !item.read).length;
  return <div className="relative"><button aria-label="Notifications" onClick={() => setOpen((value) => !value)} className="relative rounded-md p-2 text-laupay-ink-muted hover:bg-laupay-surface-muted"><Bell size={18} />{unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-laupay-amber" />}</button>{open && <div className="absolute right-0 top-11 z-50 w-80 rounded-lg border border-laupay-border bg-white p-3 shadow-xl"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-laupay-ink">Notifications</p><button className="text-xs text-laupay-indigo" onClick={() => setItems((current) => current.map((item) => ({ ...item, read: true })))}>Mark all read</button></div>{items.length === 0 ? <p className="py-5 text-sm text-laupay-ink-muted">No notifications yet.</p> : <ul className="mt-2 max-h-72 overflow-auto divide-y divide-laupay-border">{items.map((item) => <li key={item.id} className={`py-3 text-sm ${item.read ? "text-laupay-ink-muted" : "font-medium text-laupay-ink"}`}><p>{item.message}</p><p className="mt-1 text-xs text-laupay-ink-muted">{new Date(item.createdAt).toLocaleString()}</p></li>)}</ul>}</div>}</div>;
}
