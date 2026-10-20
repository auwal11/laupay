import { useEffect, useState } from "react";
import { wallet } from "@app/services";
import type { AsyncState } from "@app/types/common";
import type { WalletBalance } from "@app/types/wallet";

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
    const refresh = () => setTick((value) => value + 1);
    window.addEventListener("laupay:wallet-changed", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("laupay:wallet-changed", refresh);
    };
  }, [tick]);

  return { ...state, refetch: () => setTick((t) => t + 1) };
}
