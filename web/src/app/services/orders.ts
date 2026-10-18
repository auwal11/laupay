import { request } from "./api";
import type { ApiResult } from "@app/types/common";
import type { CreateOrderPayload, DataPlan, Network, Order } from "@app/types/orders";

const SUPPORTED_NG_NETWORKS: Network[] = [
  { id: "MTN", name: "MTN" },
  { id: "AIRTEL", name: "Airtel" },
  { id: "GLO", name: "Glo" },
  { id: "9MOBILE", name: "9mobile" },
];

/**
 * Real adapter for the backend catalog + orders modules.
 *
 * `network` values sent back on order creation are the backend network
 * *codes* ("MTN", "AIRTEL", …), so Network.id carries the code. Prices are
 * always backend-authoritative — for data orders the plan id is sent and the
 * server prices it; for airtime the server validates the amount. Paths are
 * relative to VITE_API_BASE_URL (which already includes the `/api` prefix).
 */
export const ordersService = {
  async getNetworks(): Promise<ApiResult<Network[]>> {
    return request<BackendNetwork[]>("/catalog/networks").then((result) => {
      if (!result.ok || result.data.length === 0) return { ok: true, data: SUPPORTED_NG_NETWORKS };
      const networks = result.data.filter((n) => n?.code && n?.name).map((n) => ({ id: n.code, name: n.name }));
      return { ok: true, data: networks.length > 0 ? networks : SUPPORTED_NG_NETWORKS };
    });
  },

  async getDataPlans(networkCode: string): Promise<ApiResult<DataPlan[]>> {
    return request<BackendDataPlan[]>(`/catalog/data-plans/${networkCode}`).then((result) =>
      result.ok
        ? {
            ok: true,
            data: result.data.map((p) => ({
              id: p.id,
              networkId: p.networkId,
              label: p.label,
              price: String(p.priceNaira),
            })),
          }
        : result,
    );
  },

  /**
   * Creates the order. The backend alone decides final price, debits the
   * wallet, and determines the resulting status (success/failed/pending) —
   * the frontend never assumes success from a 2xx response body shape.
   */
  async createOrder(payload: CreateOrderPayload): Promise<ApiResult<Order>> {
    const path = payload.kind === "airtime" ? "/orders/airtime" : "/orders/data";
    const body =
      payload.kind === "airtime"
        ? {
            network: payload.networkId,
            phoneNumber: payload.phoneNumber,
            amount: Number(payload.amount),
            idempotencyKey: payload.idempotencyKey,
          }
        : {
            network: payload.networkId,
            phoneNumber: payload.phoneNumber,
            dataPlanId: payload.planId,
            idempotencyKey: payload.idempotencyKey,
          };
    return request<BackendOrder>(path, { method: "POST", body }).then((result) =>
      result.ok ? { ok: true, data: normalizeOrder(result.data, payload) } : result,
    );
  },

  async getOrder(id: string): Promise<ApiResult<Order>> {
    return request<Order>(`/orders/${id}`);
  },
};

interface BackendNetwork {
  id: string;
  code: string;
  name: string;
}

interface BackendDataPlan {
  id: string;
  networkId: string;
  label: string;
  priceNaira: string | number;
}

interface BackendOrder {
  id: string;
  status: string;
  amount?: string | number;
  totalAmount?: string | number;
  createdAt: string;
}

/** Backend order rows don't carry the client-only fields the UI renders. */
function normalizeOrder(value: BackendOrder, input: CreateOrderPayload): Order {
  return {
    id: value.id,
    reference: value.id,
    kind: input.kind,
    status: String(value.status).toLowerCase() as Order["status"],
    networkId: input.networkId,
    phoneNumber: input.phoneNumber,
    amount: String(value.amount ?? value.totalAmount ?? input.amount ?? "0"),
    createdAt: value.createdAt,
  };
}
