import { NavLink } from "react-router-dom";
import { Home, Wallet, Smartphone, Wifi, Receipt, User, LayoutDashboard } from "lucide-react";
import { cn } from "@app/lib/cn";
import type { Role } from "@app/types/common";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
}

const CUSTOMER_ITEMS: NavItem[] = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/app/airtime", label: "Airtime", icon: Smartphone },
  { to: "/app/data", label: "Data", icon: Wifi },
  { to: "/app/wallet", label: "Wallet", icon: Wallet },
  { to: "/app/transactions", label: "Transactions", icon: Receipt },
  { to: "/app/profile", label: "Profile", icon: User },
];

const AGENT_ITEMS: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/wallet", label: "Wallet", icon: Wallet },
  { to: "/app/airtime", label: "Airtime", icon: Smartphone },
  { to: "/app/data", label: "Data", icon: Wifi },
  { to: "/app/transactions", label: "Transactions", icon: Receipt },
  { to: "/app/profile", label: "Profile", icon: User },
];

export function AppNav({ role }: { role: Role }) {
  const items = role === "agent" ? AGENT_ITEMS : CUSTOMER_ITEMS;

  return (
    <>
      {/* Desktop: vertical rail */}
      <nav
        aria-label="Primary"
        className="hidden w-56 shrink-0 flex-col gap-1 border-r border-laupay-border bg-white p-4 md:flex"
      >
        {items.map((item) => (
          <NavEntry key={item.to} item={item} orientation="vertical" end={item.to === "/app"} />
        ))}
      </nav>

      {/* Mobile: bottom bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-laupay-border bg-white py-1 md:hidden"
      >
        {items.map((item) => (
          <NavEntry key={item.to} item={item} orientation="horizontal" end={item.to === "/app"} />
        ))}
      </nav>
    </>
  );
}

function NavEntry({
  item,
  orientation,
  end,
}: {
  item: NavItem;
  orientation: "vertical" | "horizontal";
  end: boolean;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-md text-sm font-medium",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo",
          orientation === "vertical"
            ? "px-3 py-2.5"
            : "flex-col gap-0.5 px-3 py-1.5 text-[11px]",
          isActive
            ? "bg-laupay-surface-muted text-laupay-indigo"
            : "text-laupay-ink-muted hover:text-laupay-ink",
        )
      }
    >
      <Icon size={orientation === "vertical" ? 18 : 20} aria-hidden="true" />
      <span>{item.label}</span>
    </NavLink>
  );
}
