import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
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
  ChartColumn,
  ArrowDownToLine,
  LifeBuoy,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@app/lib/cn";
import { useAdminAuth } from "./AdminAuthContext";
import { FlowMark } from "@/components/laupay/FlowMark";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users, end: false },
  { to: "/admin/staff", label: "Staff access", icon: ShieldCheck, end: false, superAdminOnly: true },
  { to: "/admin/transactions", label: "Transactions", icon: Receipt, end: false },
  { to: "/admin/wallets", label: "Wallets", icon: Wallet, end: false },
  { to: "/admin/orders", label: "Orders", icon: ShoppingCart, end: false },
  { to: "/admin/disputes", label: "Disputes", icon: CircleAlert, end: false },
  { to: "/admin/withdrawals", label: "Withdrawals", icon: ArrowDownToLine, end: false },
  { to: "/admin/reports", label: "Reports", icon: ChartColumn, end: false },
  { to: "/admin/audit", label: "Audit log", icon: ScrollText, end: false },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon, end: false },
  { to: "/admin/support", label: "Support", icon: LifeBuoy, end: false },
];

export function AdminLayout() {
  const { session, logout } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const visibleNav = NAV.filter((item) => !("superAdminOnly" in item) || session?.isSuperAdmin);

  const onLogout = () => {
    logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="admin-shell flex min-h-screen flex-col md:flex-row">
      <aside className={cn("admin-sidebar flex flex-col border-b border-laupay-border bg-laupay-indigo text-white md:border-b-0 md:border-r", collapsed ? "md:w-[76px]" : "md:w-60")}>
        <div className={cn("flex items-center gap-2.5 px-5 py-4", collapsed && "md:justify-center md:px-3")}>
          <FlowMark inverse />
          <div className={cn("leading-tight", collapsed && "md:hidden")}>
            <p className="font-display text-base font-semibold">LAUPAY</p>
            <p className="text-[11px] font-medium text-white/55">Admin console</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pb-0">
          {visibleNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "admin-nav-item flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  collapsed && "md:justify-center md:px-2",
                  isActive
                    ? "bg-white/12 text-white"
                    : "text-white/60 hover:bg-white/8 hover:text-white",
                )
              }
            >
              <Icon size={17} aria-hidden="true" />
              <span className={collapsed ? "md:hidden" : undefined}>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={cn("hidden border-t border-white/10 px-4 py-4 md:block", collapsed && "md:px-2 md:text-center")}>
          <div className={collapsed ? "md:hidden" : undefined}>
            <p className="truncate text-xs font-medium text-white/70">{session?.email}</p>
            <p className="text-[11px] text-white/40">{session?.role}</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="admin-header flex items-center justify-between gap-3 border-b border-laupay-border bg-white px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setCollapsed((value) => !value)} className="hidden rounded-lg p-2 text-laupay-ink-muted hover:bg-laupay-surface-muted hover:text-laupay-ink md:inline-flex" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} title={collapsed ? "Expand navigation" : "Collapse navigation"}>
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <div>
            <p className="font-display text-sm font-semibold text-laupay-ink">{location.pathname === "/admin" ? "Admin Overview" : NAV.find((item) => location.pathname.startsWith(item.to) && item.to !== "/admin")?.label ?? "Administration"}</p>
            <p className="text-xs text-laupay-ink-muted md:hidden">
              {session?.email} · {session?.role}
            </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-laupay-ink-muted hover:bg-laupay-surface-muted hover:text-laupay-ink"
          >
            <LogOut size={16} aria-hidden="true" />
            Log out
          </button>
        </header>

        <main className="admin-main flex-1 px-4 py-5 sm:px-6 sm:py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
