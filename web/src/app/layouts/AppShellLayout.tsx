import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Bell, LogOut, Menu, X } from "lucide-react";
import { AppNav } from "@app/components/nav/AppNav";
import { useAuth } from "@app/context/AuthContext";
import { security } from "@app/services";
import type { SecurityNotification } from "@app/types/security";
import { assetUrl } from "@app/lib/assets";

export function AppShellLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<SecurityNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  // A route change always closes the drawer so deep links never land behind it.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let active = true;
    security.getUnreadCount().then((result) => {
      if (active && result.ok) setUnreadCount(result.data.count);
    });
    security.getNotifications().then((result) => {
      if (active && result.ok) setNotifications(result.data);
    });
    return () => { active = false; };
  }, [location.pathname]);

  const closeMobileNav = useCallback(() => {
    setMobileOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  if (!user) return null; // ProtectedRoute guarantees this, but keeps TS happy.

  return (
    <div className="flex min-h-screen bg-laupay-surface-muted">
      <AppNav role={user.role} mobileOpen={mobileOpen} onCloseMobile={closeMobileNav} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative flex items-center justify-between gap-3 border-b border-laupay-border bg-white px-5 py-3.5">
          <div className="flex items-center gap-2">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              aria-controls="laupay-mobile-nav"
              className="rounded-lg p-2 text-laupay-ink-muted hover:bg-laupay-surface-muted hover:text-laupay-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-laupay-indigo md:hidden"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <span className="font-display text-base font-semibold text-laupay-indigo">LAUPAY</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setNotificationsOpen((open) => !open)} aria-label={`${unreadCount ? `${unreadCount} unread ` : ""}notifications`} aria-expanded={notificationsOpen} className="relative rounded-lg p-2 text-laupay-ink-muted hover:bg-laupay-surface-muted hover:text-laupay-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-laupay-indigo">
              <Bell size={18} aria-hidden="true" />
              {unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-laupay-amber ring-2 ring-white" />}
            </button>
            {notificationsOpen && <NotificationPanel notifications={notifications} onClose={() => setNotificationsOpen(false)} onRead={(id) => { void security.markNotificationRead(id); setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item)); setUnreadCount((count) => Math.max(0, count - 1)); }} />}
            <Link to="/app/profile" className="hidden items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-laupay-surface-muted sm:flex">
              <Avatar user={user} />
              <span className="max-w-[120px] truncate text-xs font-semibold text-laupay-ink">{user.fullName}</span>
            </Link>
            <button onClick={logout} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-laupay-ink-muted hover:bg-laupay-surface-muted hover:text-laupay-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-laupay-indigo">
              <LogOut size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-5 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NotificationPanel({ notifications, onClose, onRead }: { notifications: SecurityNotification[]; onClose: () => void; onRead: (id: string) => void }) {
  return <div className="absolute right-4 top-14 z-50 w-[min(92vw,360px)] rounded-xl border border-laupay-border bg-white p-4 shadow-raised" role="dialog" aria-label="Notifications"><div className="flex items-center justify-between"><h2 className="font-display text-sm font-semibold text-laupay-ink">Notifications</h2><button type="button" onClick={onClose} aria-label="Close notifications" className="rounded p-1 text-laupay-ink-muted hover:bg-laupay-surface-muted"><X size={16} /></button></div>{notifications.length === 0 ? <p className="mt-4 text-sm text-laupay-ink-muted">No notifications yet.</p> : <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">{notifications.map((item) => <li key={item.id} className={`rounded-lg p-3 text-sm ${item.read ? "bg-laupay-surface-muted" : "bg-laupay-amber/10"}`}><p className="text-laupay-ink">{item.message}</p><div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs text-laupay-ink-muted">{new Date(item.createdAt).toLocaleString()}</span>{!item.read && <button type="button" onClick={() => onRead(item.id)} className="text-xs font-semibold text-laupay-indigo hover:underline">Mark read</button>}</div></li>)}</ul>}<Link to="/app/security" onClick={onClose} className="mt-3 inline-block text-xs font-semibold text-laupay-indigo hover:underline">Security notifications</Link></div>;
}

function Avatar({ user }: { user: { fullName: string; profilePhotoUrl?: string | null } }) {
  const initials = user.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  if (user.profilePhotoUrl) return <img src={assetUrl(user.profilePhotoUrl)} alt="" className="h-8 w-8 rounded-full object-cover" />;
  return <span className="flex h-8 w-8 items-center justify-center rounded-full bg-laupay-indigo text-[10px] font-extrabold text-white">{initials || "L"}</span>;
}
