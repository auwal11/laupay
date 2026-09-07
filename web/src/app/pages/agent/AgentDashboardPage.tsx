import { Link } from "react-router-dom";
import { Smartphone, Wifi } from "lucide-react";
import { BalanceCard } from "@app/components/wallet/BalanceCard";
import { TransactionList } from "@app/components/wallet/TransactionList";
import { useAuth } from "@app/context/AuthContext";

export function AgentDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-laupay-ink">
          Hi {user?.fullName.split(" ")[0]}
        </h1>
        <p className="text-sm text-laupay-ink-muted">Agent overview — wallet and recent sales.</p>
      </div>

      <BalanceCard />

      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/app/airtime"
          className="flex items-center gap-3 rounded-lg border border-laupay-border bg-white px-4 py-4 hover:border-laupay-indigo"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-laupay-amber-soft text-laupay-indigo">
            <Smartphone size={18} aria-hidden="true" />
          </span>
          <span className="text-sm font-medium text-laupay-ink">Sell airtime</span>
        </Link>
        <Link
          to="/app/data"
          className="flex items-center gap-3 rounded-lg border border-laupay-border bg-white px-4 py-4 hover:border-laupay-indigo"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-laupay-amber-soft text-laupay-indigo">
            <Wifi size={18} aria-hidden="true" />
          </span>
          <span className="text-sm font-medium text-laupay-ink">Sell data</span>
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-laupay-ink">Recent sales</h2>
        <TransactionList limit={8} />
      </div>
    </div>
  );
}
