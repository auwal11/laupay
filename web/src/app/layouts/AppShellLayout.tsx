import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { AppNav } from "@app/components/nav/AppNav";
import { useAuth } from "@app/context/AuthContext";

export function AppShellLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  // A route change always closes the drawer so deep links never land behind it.
  useEffect(() => {
    setMobileOpen(false);
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
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-laupay-ink-muted hover:bg-laupay-surface-muted hover:text-laupay-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-laupay-indigo"
          >
            <LogOut size={16} aria-hidden="true" />
            Log out
          </button>
        </header>

        <main className="flex-1 px-5 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
