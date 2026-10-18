import { useCallback, useEffect, useState } from "react";
import { orders } from "@/services";
import { generateIdempotencyKey } from "@/lib/idempotency";
import type { ApiError } from "@/types/common";
import type { DataPlan, Network, Order, PurchaseKind } from "@/types/orders";

export type PurchaseStep =
  | "select_network"
  | "enter_phone"
  | "select_amount_plan"
  | "review"
  | "processing"
  | "verify" // backend returned a VERIFY risk decision — collecting the PIN/OTP it asked for
  | "result";

interface PurchaseFlowState {
  step: PurchaseStep;
  networks: Network[];
  plans: DataPlan[]; // only populated for kind === "data"
  networkId: string | null;
  phoneNumber: string;
  amount: string | null; // airtime only — a fixed shortlist, never free text pricing logic
  planId: string | null; // data only
  idempotencyKey: string;
  order: Order | null;
  error: ApiError | null;
  verifyError: string | null;
  pin?: string;
}

const AIRTIME_AMOUNTS = ["100", "200", "500", "1000", "2000"];

const unexpectedPurchaseError: ApiError = {
  code: "PURCHASE_FAILED",
  message: "We could not complete this purchase. Please try again.",
};

function initialState(): PurchaseFlowState {
  return {
    step: "select_network",
    networks: [],
    plans: [],
    networkId: null,
    phoneNumber: "",
    amount: null,
    planId: null,
    idempotencyKey: generateIdempotencyKey(),
    order: null,
    error: null,
    verifyError: null,
    pin: undefined,
  };
}

export function usePurchaseFlow(kind: PurchaseKind) {
  const [state, setState] = useState<PurchaseFlowState>(initialState);
  const setPin = useCallback((pin: string) => setState((s) => ({ ...s, pin })), []);

  useEffect(() => {
    orders.getNetworks().then((result) => {
      if (result.ok) setState((s) => ({ ...s, networks: result.data }));
    });
  }, []);

  const selectNetwork = useCallback(
    (networkId: string) => {
      setState((s) => ({ ...s, networkId, step: "enter_phone" }));
      if (kind === "data") {
        orders.getDataPlans(networkId).then((result) => {
          if (result.ok) setState((s) => ({ ...s, plans: result.data }));
        });
      }
    },
    [kind],
  );

  const submitPhoneNumber = useCallback((phoneNumber: string) => {
    setState((s) => ({ ...s, phoneNumber, step: "select_amount_plan" }));
  }, []);

  const selectAmount = useCallback((amount: string) => {
    setState((s) => ({ ...s, amount, planId: null, step: "review" }));
  }, []);

  const selectPlan = useCallback((planId: string) => {
    setState((s) => ({ ...s, planId, amount: null, step: "review" }));
  }, []);

  /** Interprets the order the backend returns and routes to the right step — never assumes success from a 2xx. */
  const routeOrderResult = useCallback((order: Order) => {
    if (order.status === "auth_required") {
      setState((prev) => ({ ...prev, order, step: "verify", verifyError: null }));
    } else {
      setState((prev) => ({ ...prev, order, step: "result" }));
    }
  }, []);

  const confirm = useCallback(() => {
    const networkId = state.networkId;
    if (!networkId) return;
    setState((s) => ({ ...s, step: "processing", error: null }));
    orders
      .createOrder({
        kind,
        networkId,
        phoneNumber: state.phoneNumber,
        amount: state.amount ?? undefined,
        planId: state.planId ?? undefined,
        idempotencyKey: state.idempotencyKey,
        pin: state.pin,
      })
      .then((result) => {
        if (result.ok) {
          routeOrderResult(result.data);
        } else {
          setState((prev) => ({ ...prev, error: result.error, step: "result" }));
        }
      })
      .catch(() => setState((prev) => ({ ...prev, error: unexpectedPurchaseError, step: "result" })));
  }, [kind, state.networkId, state.phoneNumber, state.amount, state.planId, state.idempotencyKey, state.pin, routeOrderResult]);

  /** Submits the PIN/OTP the backend's VERIFY decision asked for. Same idempotency key resolves the same order. */
  const submitVerification = useCallback(
    (code: string) => {
      const networkId = state.networkId;
      if (!networkId) return;
      setState((s) => ({ ...s, step: "processing", verifyError: null }));
      orders
        .createOrder({
          kind,
          networkId,
          phoneNumber: state.phoneNumber,
          amount: state.amount ?? undefined,
          planId: state.planId ?? undefined,
          idempotencyKey: state.idempotencyKey,
          verificationCode: code,
          pin: code,
        })
        .then((result) => {
          if (result.ok) {
            if (result.data.status === "failed" && result.data.failureReason?.toLowerCase().includes("pin")) {
              setState((prev) => ({ ...prev, step: "verify", verifyError: result.data.failureReason ?? null }));
            } else {
              setState((prev) => ({ ...prev, order: result.data, step: "result" }));
            }
          } else {
            setState((prev) => ({ ...prev, error: result.error, step: "result" }));
          }
        })
        .catch(() => setState((prev) => ({ ...prev, error: unexpectedPurchaseError, step: "result" })));
    },
    [kind, state.networkId, state.phoneNumber, state.amount, state.planId, state.idempotencyKey],
  );

  const restart = useCallback(() => {
    setState((s) => ({ ...initialState(), networks: s.networks }));
  }, []);

  const goBack = useCallback(() => {
    setState((s) => {
      const prevStep: Partial<Record<PurchaseStep, PurchaseStep>> = {
        enter_phone: "select_network",
        select_amount_plan: "enter_phone",
        review: "select_amount_plan",
      };
      const target = prevStep[s.step];
      return target ? { ...s, step: target } : s;
    });
  }, []);

  return {
    state,
    airtimeAmounts: AIRTIME_AMOUNTS,
    selectNetwork,
    submitPhoneNumber,
    selectAmount,
    selectPlan,
    confirm,
    submitVerification,
    setPin,
    restart,
    goBack,
  };
}
