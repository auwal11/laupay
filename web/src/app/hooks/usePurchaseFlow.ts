import { useCallback, useEffect, useState } from "react";
import { orders } from "@app/services";
import { generateIdempotencyKey } from "@app/lib/idempotency";
import type { ApiError } from "@app/types/common";
import type { DataPlan, Network, Order, PurchaseKind } from "@app/types/orders";

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
  /** Bumped on each rejected PIN so the pad remounts and clears its digits. */
  verifyAttempt: number;
  networksLoading: boolean;
  networkError: string | null;
  plansLoading: boolean;
  plansError: string | null;
  processingLabel: "Verifying PIN…" | "Processing payment…";
}

const AIRTIME_AMOUNTS = ["100", "200", "500", "1000", "2000"];

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
    verifyAttempt: 0,
    networksLoading: true,
    networkError: null,
    plansLoading: false,
    plansError: null,
    processingLabel: "Verifying PIN…",
  };
}

export function usePurchaseFlow(kind: PurchaseKind) {
  const [state, setState] = useState<PurchaseFlowState>(initialState);

  const loadNetworks = useCallback(() => {
    setState((s) => ({ ...s, networksLoading: true, networkError: null }));
    orders.getNetworks().then((result) => {
      if (result.ok && result.data.length > 0) setState((s) => ({ ...s, networks: result.data, networksLoading: false }));
      else setState((s) => ({ ...s, networksLoading: false, networkError: "Unable to load networks. Please try again." }));
    }).catch(() => setState((s) => ({ ...s, networksLoading: false, networkError: "Unable to load networks. Please try again." })));
  }, []);

  useEffect(() => { loadNetworks(); }, [loadNetworks]);

  const loadPlans = useCallback((networkId: string) => {
    setState((s) => ({ ...s, plansLoading: true, plansError: null }));
    orders.getDataPlans(networkId).then((result) => {
      if (result.ok && result.data.length > 0) setState((s) => ({ ...s, plans: result.data, plansLoading: false }));
      else setState((s) => ({ ...s, plans: [], plansLoading: false, plansError: "Unable to load data plans. Please try again." }));
    }).catch(() => setState((s) => ({ ...s, plans: [], plansLoading: false, plansError: "Unable to load data plans. Please try again." })));
  }, []);

  const selectNetwork = useCallback(
    (networkId: string) => {
      setState((s) => ({ ...s, networkId, step: "enter_phone" }));
      if (kind === "data") loadPlans(networkId);
    },
    [kind, loadPlans],
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
  const pollOrder = useCallback(async (orderId: string) => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 5000));
      const result = await orders.getOrder(orderId);
      if (!result.ok) return;
      setState((prev) => ({ ...prev, order: result.data }));
      if (!["pending", "processing", "unknown"].includes(result.data.status)) return;
    }
  }, []);

  const routeOrderResult = useCallback((order: Order) => {
    if (order.status === "auth_required") {
      setState((prev) => ({ ...prev, order, step: "verify", verifyError: null }));
    } else {
      setState((prev) => ({ ...prev, order, step: "result" }));
      if (["pending", "processing", "unknown"].includes(order.status)) {
        void pollOrder(order.id);
      }
    }
  }, [pollOrder]);

  /**
   * "Confirm purchase" on the review step no longer creates anything — it
   * moves to the PIN step. Nothing is created or debited until the backend
   * accepts the transaction PIN (see submitVerification).
   */
  const confirm = useCallback(() => {
    if (!state.networkId) return;
    setState((s) => ({ ...s, step: "verify", verifyError: null, error: null }));
  }, [state.networkId]);

  /** Submits the transaction PIN; only on success is the order created/debited. */
  const submitVerification = useCallback(
    (pin: string) => {
      const networkId = state.networkId;
      if (!networkId) return;
      setState((s) => ({ ...s, step: "processing", processingLabel: "Verifying PIN…", verifyError: null }));
      window.setTimeout(() => {
        setState((s) => s.step === "processing" ? { ...s, processingLabel: "Processing payment…" } : s);
      }, 700);
      orders
        .createOrder({
          kind,
          networkId,
          phoneNumber: state.phoneNumber,
          amount: state.amount ?? undefined,
          planId: state.planId ?? undefined,
          idempotencyKey: state.idempotencyKey,
          pin,
        })
        .then((result) => {
          if (result.ok) {
            routeOrderResult(result.data);
            return;
          }
          // A rejected PIN (wrong / locked / not set) is a step-up failure, not
          // a failed purchase — stay on the PIN step so they can retry.
          if (isPinRejection(result.error)) {
            setState((prev) => ({
              ...prev,
              step: "verify",
              verifyError: result.error.message,
              verifyAttempt: prev.verifyAttempt + 1,
            }));
            return;
          }
          setState((prev) => ({ ...prev, error: result.error, step: "result" }));
        });
    },
    [kind, state.networkId, state.phoneNumber, state.amount, state.planId, state.idempotencyKey, routeOrderResult],
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
    loadNetworks,
    retryPlans: () => { if (state.networkId) loadPlans(state.networkId); },
    airtimeAmounts: AIRTIME_AMOUNTS,
    selectNetwork,
    submitPhoneNumber,
    selectAmount,
    selectPlan,
    confirm,
    submitVerification,
    restart,
    goBack,
  };
}

/**
 * True when the failure is the PIN step-up itself (wrong, locked, or not set),
 * as opposed to a genuine purchase failure. The backend returns 403/400 with a
 * message mentioning "PIN" for these, so the user is kept on the PIN step
 * rather than being shown a "purchase failed" result.
 */
function isPinRejection(error: ApiError): boolean {
  return /\bpin\b/i.test(error.message);
}
