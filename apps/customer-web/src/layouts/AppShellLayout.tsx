import { Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { AppNav } from "@/components/nav/AppNav";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export function AppShellLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  if (!user) return null; // ProtectedRoute guarantees this, but keeps TS happy.

  return (
    <div className="flex min-h-screen bg-laupay-surface-muted">
      <AppNav role={user.role} />

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-laupay-border bg-white px-5 py-3.5">
          <div className="flex items-center gap-2"><UserAvatar user={user} size="sm" /><span className="font-display text-base font-semibold text-laupay-indigo">LAUPAY</span></div>
          <div className="flex items-center gap-2"><NotificationBell />
          <button
            onClick={async () => { setLoggingOut(true); await logout(); navigate("/login", { replace: true }); }}
            disabled={loggingOut}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-laupay-ink-muted hover:bg-laupay-surface-muted hover:text-laupay-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-laupay-indigo"
          >
            <LogOut size={16} aria-hidden="true" />
            {loggingOut ? "Signing out…" : "Log out"}
          </button></div>
        </header>

        <main className="flex-1 px-5 py-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
