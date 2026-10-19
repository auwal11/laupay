import { request } from "./api";
import type { ApiResult } from "@app/types/common";
import type { DisputeReason, TransactionDispute } from "@app/types/disputes";
export const disputesService = {
  create(transactionId: string, reason: DisputeReason, details: string): Promise<ApiResult<TransactionDispute>> { return request<TransactionDispute>("/disputes", { method: "POST", body: { transactionId, reason, details } }); },
  list(): Promise<ApiResult<TransactionDispute[]>> { return request<TransactionDispute[]>("/disputes"); },
};
