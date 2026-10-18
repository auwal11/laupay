import { request } from "./api";
import type { ApiResult } from "@/types/common";
import type { CreateOrderPayload, DataPlan, Network, Order } from "@/types/orders";

/** Public Nigerian network identifiers accepted by the backend catalog/order APIs. */
export const SUPPORTED_NG_NETWORKS: Network[] = [
  { id: "MTN", name: "MTN" },
  { id: "AIRTEL", name: "Airtel" },
  { id: "GLO", name: "Glo" },
  { id: "9MOBILE", name: "9mobile" },
]; 

/** Expected backend endpoints — confirm exact paths/shapes with the backend agent. */
export const ordersService = {
  async getNetworks(): Promise<ApiResult<Network[]>> {
    return request<any[]>("/api/catalog/networks").then((result) => {
      if (!result.ok || result.data.length === 0) {
        // Network selection is a public catalog, not transaction data. Keep the
        // supported NG choices usable while the backend catalog is unavailable.
        return { ok: true, data: SUPPORTED_NG_NETWORKS };
      }
      const networks = result.data
        .filter((network) => network?.code && network?.name)
        .map((network) => ({ id: network.code, name: network.name, code: network.code }));
      return { ok: true, data: networks.length > 0 ? networks : SUPPORTED_NG_NETWORKS };
    });
  },

  async getDataPlans(networkId: string): Promise<ApiResult<DataPlan[]>> {
    return request<any[]>(`/api/catalog/data-plans/${networkId}`).then((result) => result.ok ? { ok: true, data: result.data.map((p) => ({ id: p.id, networkId: p.networkId, label: p.label, price: String(p.priceNaira) })) } : result);
  },

  /**
   * Creates the order. The backend alone decides final price, debits the
   * wallet, and determines the resulting status (success/failed/pending) —
   * the frontend never assumes success from a 2xx response body shape.
   */
  async createOrder(payload: CreateOrderPayload): Promise<ApiResult<Order>> {
    const path = payload.kind === "airtime" ? "/api/orders/airtime" : "/api/orders/data";
    const body = payload.kind === "airtime"
      ? { network: payload.networkId, phoneNumber: payload.phoneNumber, amount: Number(payload.amount), idempotencyKey: payload.idempotencyKey, pin: payload.pin }
      : { network: payload.networkId, phoneNumber: payload.phoneNumber, dataPlanId: payload.planId, idempotencyKey: payload.idempotencyKey, pin: payload.pin };
    return request<any>(path, { method: "POST", body }).then((result) => result.ok ? { ok: true, data: normalizeOrder(result.data, payload) } : result);
  },

  async getOrder(id: string): Promise<ApiResult<Order>> {
    return request<Order>(`/api/orders/${id}`);
  },
};

function normalizeOrder(value: any, input: CreateOrderPayload): Order {
  return { ...value, reference: value.id, kind: input.kind, status: String(value.status).toLowerCase(), networkId: input.networkId, phoneNumber: input.phoneNumber, amount: String(value.amount ?? value.totalAmount ?? input.amount ?? "0"), createdAt: value.createdAt };
}
