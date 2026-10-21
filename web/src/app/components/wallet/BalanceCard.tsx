import { ArrowUpRight, Plus } from "lucide-react";
import { Card } from "@app/components/ui/Card";
import { Skeleton } from "@app/components/ui/Skeleton";
import { ErrorState } from "@app/components/ui/ErrorState";
import { formatNaira } from "@app/lib/format";
import { useWalletBalance } from "@app/hooks/useWallet";

export function BalanceCard({ onAddFund, onWithdraw }: { onAddFund?: () => void; onWithdraw?: () => void } = {}) {
  const state = useWalletBalance();

  if (state.status === "loading") {
    return (
      <Card className="rounded-2xl">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-9 w-40" />
      </Card>
    );
  }

  if (state.status === "error") {
    return <ErrorState error={state.error} onRetry={state.refetch} />;
  }

  if (state.status !== "success") return null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-laupay-indigo p-6 text-white shadow-raised">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-white/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 top-6 h-32 w-32 rounded-full border border-laupay-amber/20"
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
            Available balance
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/75">
            <span className="h-1.5 w-1.5 rounded-full bg-laupay-amber" /> Wallet
          </span>
        </div>
        <p className="mt-3 font-display text-[2.1rem] font-semibold leading-none tabular-nums">
          {formatNaira(state.data.ngnAvailableBalance ?? state.data.ngnBalance)}
        </p>
        {state.data.ngnAvailableBalance !== state.data.ngnBalance && (
          <p className="mt-2 text-xs text-white/55">
            {formatNaira(state.data.ngnBalance)} total balance
          </p>
        )}
        {(state.data.ngnPendingBalance && Number(state.data.ngnPendingBalance) > 0) ||
        (state.data.ngnHeldBalance && Number(state.data.ngnHeldBalance) > 0) ? (
          <div className="mt-4 flex gap-5 border-t border-white/12 pt-3 text-xs text-white/65">
            {state.data.ngnPendingBalance && Number(state.data.ngnPendingBalance) > 0 && (
              <span>{formatNaira(state.data.ngnPendingBalance)} pending</span>
            )}
            {state.data.ngnHeldBalance && Number(state.data.ngnHeldBalance) > 0 && (
              <span>{formatNaira(state.data.ngnHeldBalance)} held</span>
            )}
          </div>
        ) : null}
        {(onAddFund || onWithdraw) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {onAddFund && (
              <button
                type="button"
                onClick={onAddFund}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-laupay-indigo transition hover:bg-laupay-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <Plus size={16} /> Add funds
              </button>
            )}
            {onWithdraw && (
              <button
                type="button"
                onClick={onWithdraw}
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ArrowUpRight size={16} /> Withdraw
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
