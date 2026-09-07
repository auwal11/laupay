import { request } from "./api";
import type { ApiResult } from "@app/types/common";
import type { Transaction, TransactionDetail, WalletBalance, WalletFundingPayload } from "@app/types/wallet";

/** Expected backend endpoints — confirm exact paths/shapes with the backend agent. */
export const walletService = {
  async getBalance(): Promise<ApiResult<WalletBalance>> {
    return request<WalletBalance>("/wallet/balance");
  },

  async getTransactions(): Promise<ApiResult<Transaction[]>> {
    return request<Transaction[]>("/wallet/transactions");
  },

  async getTransaction(id: string): Promise<ApiResult<TransactionDetail>> {
    return request<TransactionDetail>(`/wallet/transactions/${id}`);
  },

  async fundWallet(payload: WalletFundingPayload): Promise<ApiResult<Transaction>> {
    // Backend remains authoritative for verifying/settling the funding —
    // this only initiates the request.
    return request<Transaction>("/wallet/fund", { method: "POST", body: payload });
  },
};
