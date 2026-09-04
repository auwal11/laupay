import { request } from "./api";
import type { ApiResult } from "@/types/common";
import type { CreateOrderPayload, DataPlan, Network, Order } from "@/types/orders";

/** Expected backend endpoints — confirm exact paths/shapes with the backend agent. */
export const ordersService = {
  async getNetworks(): Promise<ApiResult<Network[]>> {
    return request<Network[]>("/networks");
  },

  async getDataPlans(networkId: string): Promise<ApiResult<DataPlan[]>> {
    return request<DataPlan[]>(`/networks/${networkId}/data-plans`);
  },

  /**
   * Creates the order. The backend alone decides final price, debits the
   * wallet, and determines the resulting status (success/failed/pending) —
   * the frontend never assumes success from a 2xx response body shape.
   */
  async createOrder(payload: CreateOrderPayload): Promise<ApiResult<Order>> {
    return request<Order>("/orders", { method: "POST", body: payload });
  },

  async getOrder(id: string): Promise<ApiResult<Order>> {
    return request<Order>(`/orders/${id}`);
  },
};
