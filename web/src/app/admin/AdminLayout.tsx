import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  LogOut,
  Receipt,
  ScrollText,
  Settings as SettingsIcon,
  ShoppingCart,
  Users,
  Wallet,
  CircleAlert,
} from "lucide-react";
import { cn } from "@app/lib/cn";
import { useAdminAuth } from "./AdminAuthContext";
import { FlowMark } from "@/components/laupay/FlowMark";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users, end: false },
  { to: "/admin/transactions", label: "Transactions", icon: Receipt, end: false },
  { to: "/admin/wallets", label: "Wallets", icon: Wallet, end: false },
  { to: "/admin/orders", label: "Orders", icon: ShoppingCart, end: false },
  { to: "/admin/disputes", label: "Disputes", icon: CircleAlert, end: false },
  { to: "/admin/audit", label: "Audit log", icon: ScrollText, end: false },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon, end: false },
];

export function AdminLayout() {
  const { session, logout } = useAdminAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-laupay-surface-muted md:flex-row">
      <aside className="flex flex-col border-b border-laupay-border bg-laupay-indigo text-white md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <FlowMark inverse />
          <div className="leading-tight">
            <p className="font-display text-base font-semibold">LAUPAY</p>
            <p className="text-[11px] font-medium text-white/55">Admin console</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pb-0">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white/12 text-white"
                    : "text-white/60 hover:bg-white/8 hover:text-white",
                )
              }
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t border-white/10 px-4 py-4 md:block">
          <p className="truncate text-xs font-medium text-white/70">{session?.email}</p>
          <p className="text-[11px] text-white/40">{session?.role}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-laupay-border bg-white px-5 py-3.5">
          <div>
            <p className="font-display text-sm font-semibold text-laupay-ink">
              Administration
            </p>
            <p className="text-xs text-laupay-ink-muted md:hidden">
              {session?.email} · {session?.role}
            </p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-laupay-ink-muted hover:bg-laupay-surface-muted hover:text-laupay-ink"
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
