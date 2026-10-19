import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Bell, LogOut, Menu } from "lucide-react";
import { AppNav } from "@app/components/nav/AppNav";
import { useAuth } from "@app/context/AuthContext";
import { security } from "@app/services";

export function AppShellLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
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
        <header className="flex items-center justify-between gap-3 border-b border-laupay-border bg-white px-5 py-3.5">
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
            <Link to="/app/security" aria-label={`${unreadCount ? `${unreadCount} unread ` : ""}notifications`} className="relative rounded-lg p-2 text-laupay-ink-muted hover:bg-laupay-surface-muted hover:text-laupay-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-laupay-indigo">
              <Bell size={18} aria-hidden="true" />
              {unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-laupay-amber ring-2 ring-white" />}
            </Link>
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

function Avatar({ user }: { user: { fullName: string; profilePhotoUrl?: string | null } }) {
  const initials = user.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  if (user.profilePhotoUrl) return <img src={user.profilePhotoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />;
  return <span className="flex h-8 w-8 items-center justify-center rounded-full bg-laupay-indigo text-[10px] font-extrabold text-white">{initials || "L"}</span>;
}
