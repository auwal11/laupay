import { Link } from "react-router-dom";
import { Smartphone, Wifi } from "lucide-react";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { TransactionList } from "@/components/wallet/TransactionList";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/ui/UserAvatar";

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3"><UserAvatar user={user!} /><div><h1 className="font-display text-xl font-semibold text-laupay-ink">Hi {user?.fullName.split(" ")[0]}</h1><p className="text-xs capitalize text-laupay-ink-muted">{user?.role}</p></div></div>
        <p className="text-sm text-laupay-ink-muted">Here's what's happening with your account.</p>
      </div>

      <BalanceCard />

      <div className="grid grid-cols-2 gap-3">
        <QuickAction to="/app/airtime" icon={Smartphone} label="Buy airtime" />
        <QuickAction to="/app/data" icon={Wifi} label="Buy data" />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-laupay-ink">Recent transactions</h2>
          <Link to="/app/transactions" className="text-sm font-medium text-laupay-indigo hover:underline">
            See all
          </Link>
        </div>
        <TransactionList limit={5} />
      </div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: typeof Smartphone; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border border-laupay-border bg-white px-4 py-4 hover:border-laupay-indigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-indigo"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-laupay-amber-soft text-laupay-indigo">
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="text-sm font-medium text-laupay-ink">{label}</span>
    </Link>
  );
}
