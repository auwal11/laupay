import { useEffect, useState } from "react";
import { wallet } from "@app/services";
import type { AsyncState } from "@app/types/common";
import type { Transaction } from "@app/types/wallet";

export function useTransactions(): AsyncState<Transaction[]> {
  const [state, setState] = useState<AsyncState<Transaction[]>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    wallet.getTransactions().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setState({ status: "error", error: result.error });
      } else if (result.data.length === 0) {
        setState({ status: "empty" });
      } else {
        setState({ status: "success", data: result.data });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
