import { Link } from "react-router-dom";
import { CreditCard, Receipt, Smartphone, Store, Wallet, Wifi } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BalanceCard } from "@app/components/wallet/BalanceCard";
import { TransactionList } from "@app/components/wallet/TransactionList";
import { useAuth } from "@app/context/AuthContext";

const QUICK_ACTIONS: { to: string; icon: LucideIcon; label: string; ready: boolean }[] = [
  { to: "/app/airtime", icon: Smartphone, label: "Airtime", ready: true },
  { to: "/app/data", icon: Wifi, label: "Data", ready: true },
  { to: "/app/wallet", icon: Wallet, label: "Wallet", ready: true },
  { to: "/app/transactions", icon: CreditCard, label: "Payments", ready: true },
  { to: "/app/transactions", icon: Store, label: "POS", ready: false },
  { to: "/app/transactions", icon: Receipt, label: "Bills", ready: false },
];

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-7">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-laupay-ink-muted">
          Built for everyday payments
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-laupay-ink">
          Hi {user?.fullName.split(" ")[0]}
        </h1>
        <p className="text-sm text-laupay-ink-muted">Here's what's happening with your account.</p>
      </div>

      <BalanceCard />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-laupay-ink">Quick actions</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {QUICK_ACTIONS.map((action) => (
            <QuickAction key={action.label} {...action} />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-laupay-ink">Recent activity</h2>
          <Link to="/app/transactions" className="text-sm font-medium text-laupay-indigo hover:underline">
            See all
          </Link>
        </div>
        <TransactionList limit={5} />
      </div>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  ready,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  ready: boolean;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-center gap-2 rounded-xl border border-laupay-border bg-white px-2 py-4 shadow-card transition-colors hover:border-laupay-indigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo"
    >
      <span
        className={
          ready
            ? "flex h-10 w-10 items-center justify-center rounded-lg bg-laupay-indigo text-white"
            : "flex h-10 w-10 items-center justify-center rounded-lg bg-laupay-surface-muted text-laupay-ink-muted"
        }
      >
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="text-xs font-semibold text-laupay-ink">{label}</span>
    </Link>
  );
}
