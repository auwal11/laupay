import { request } from "./api";
import type { ApiResult } from "@app/types/common";
import type { Beneficiary, BeneficiaryPayload } from "@app/types/beneficiaries";

export const beneficiariesService = {
  list(): Promise<ApiResult<Beneficiary[]>> {
    return request<Beneficiary[]>("/beneficiaries");
  },

  /** Idempotent: saving the same number + network updates the existing row. */
  save(payload: BeneficiaryPayload): Promise<ApiResult<Beneficiary>> {
    return request<Beneficiary>("/beneficiaries", { method: "POST", body: payload });
  },

  update(id: string, payload: Partial<BeneficiaryPayload>): Promise<ApiResult<Beneficiary>> {
    return request<Beneficiary>(`/beneficiaries/${id}`, { method: "PATCH", body: payload });
  },

  remove(id: string): Promise<ApiResult<{ deleted: true }>> {
    return request<{ deleted: true }>(`/beneficiaries/${id}`, { method: "DELETE" });
  },
};
