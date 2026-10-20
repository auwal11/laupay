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
    // Orders can move from confirming to a terminal provider result after the
    // initial ledger read. Refresh while this screen is open so status pills
    // and debit totals reflect the backend ledger without a manual reload.
    const refresh = window.setInterval(() => { void load(); }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, []);

  return state;
}
