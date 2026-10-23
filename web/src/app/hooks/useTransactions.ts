import { useEffect, useState } from "react";
import { wallet } from "@app/services";
import type { AsyncState } from "@app/types/common";
import type { Transaction } from "@app/types/wallet";

export function useTransactions(): AsyncState<Transaction[]> {
  const [state, setState] = useState<AsyncState<Transaction[]>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const load = () => wallet.getTransactions().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setState({ status: "error", error: result.error });
      } else if (result.data.length === 0) {
        setState({ status: "empty" });
      } else {
        setState({ status: "success", data: result.data });
      }
    });
    void load();
    // Withdrawals and orders can move through several backend-controlled
    // states after the initial ledger read. Refresh while this screen is open
    // and when the customer returns to the tab so the history reflects admin
    // actions without requiring a manual reload.
    const refreshOnFocus = () => void load();
    const refreshOnVisible = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisible);
    const refresh = window.setInterval(() => { void load(); }, 8000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
      window.clearInterval(refresh);
    };
  }, []);

  return state;
}
