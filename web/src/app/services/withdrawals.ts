import { request } from "./api";
import type { ApiResult } from "@app/types/common";
import type { Withdrawal, WithdrawalInput } from "@app/types/withdrawals";

export const withdrawalsService = {
  async banks(): Promise<ApiResult<Array<{ code: string; name: string }>>> {
    return request<Array<{ code: string; name: string }>>("/withdrawals/banks");
  },
  async request(payload: WithdrawalInput): Promise<ApiResult<Withdrawal>> {
    return request<Withdrawal>("/withdrawals", {
      method: "POST",
      body: {
        amount: Number(payload.amount),
        bankName: payload.bankName,
        accountName: payload.accountName,
        accountNumber: payload.accountNumber,
        pin: payload.pin,
        idempotencyKey: payload.idempotencyKey,
      },
    });
  },

  async list(): Promise<ApiResult<Withdrawal[]>> {
    return request<Withdrawal[]>("/withdrawals");
  },
};
