import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatNaira } from "@/lib/format";
import { useWalletBalance } from "@/hooks/useWallet";

export function BalanceCard() {
  const state = useWalletBalance();

  if (state.status === "loading") {
    return (
      <Card>
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
    <Card className="!border-laupay-indigo !bg-laupay-indigo text-white">
      <p className="text-sm text-white/70">Wallet balance</p>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
        {formatNaira(state.data.ngnBalance)}
      </p>
      {state.data.ngnAvailableBalance !== state.data.ngnBalance && (
        <p className="mt-1 text-xs text-white/60">
          {formatNaira(state.data.ngnAvailableBalance)} available
        </p>
      )}
      {(state.data.ngnPendingBalance && Number(state.data.ngnPendingBalance) > 0) ||
      (state.data.ngnHeldBalance && Number(state.data.ngnHeldBalance) > 0) ? (
        <div className="mt-3 flex gap-4 border-t border-white/15 pt-3 text-xs text-white/70">
          {state.data.ngnPendingBalance && Number(state.data.ngnPendingBalance) > 0 && (
            <span>{formatNaira(state.data.ngnPendingBalance)} pending</span>
          )}
          {state.data.ngnHeldBalance && Number(state.data.ngnHeldBalance) > 0 && (
            <span>{formatNaira(state.data.ngnHeldBalance)} held</span>
          )}
        </div>
      ) : null}
    </Card>
  );
}
