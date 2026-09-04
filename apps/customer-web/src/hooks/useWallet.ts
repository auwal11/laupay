import { useEffect, useState } from "react";
import { wallet } from "@/services";
import type { AsyncState } from "@/types/common";
import type { WalletBalance } from "@/types/wallet";

export function useWalletBalance(): AsyncState<WalletBalance> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<WalletBalance>>({ status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    wallet.getBalance().then((result) => {
      if (cancelled) return;
      setState(result.ok ? { status: "success", data: result.data } : { status: "error", error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { ...state, refetch: () => setTick((t) => t + 1) };
}
