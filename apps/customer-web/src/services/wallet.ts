import { request } from "./api";
import type { ApiResult } from "@/types/common";
import type { Transaction, TransactionDetail, WalletBalance, WalletFundingPayload } from "@/types/wallet";

/** Expected backend endpoints — confirm exact paths/shapes with the backend agent. */
export const walletService = {
  async getBalance(): Promise<ApiResult<WalletBalance>> {
    return request<any>("/api/wallet").then((result) => result.ok ? {
      ok: true,
      data: { ...result.data, ngnBalance: String(result.data.balance ?? result.data.ngnBalance ?? "0"), ngnAvailableBalance: String(result.data.balance ?? result.data.ngnAvailableBalance ?? "0"), currency: result.data.currency ?? "NGN", updatedAt: result.data.updatedAt ?? new Date().toISOString() },
    } : result);
  },

  async getTransactions(): Promise<ApiResult<Transaction[]>> {
    return request<unknown[]>("/api/wallet/transactions").then((result) => result.ok ? {
      ok: true,
      data: result.data.map((entry: any): Transaction => ({ id: entry.id, reference: entry.referenceId ?? entry.id, type: "wallet_debit", status: "success", amount: String(entry.amount), description: `${entry.direction === "CREDIT" ? "Wallet credit" : "Wallet debit"}`, createdAt: entry.createdAt })),
    } : result);
  },

  async getTransaction(id: string): Promise<ApiResult<TransactionDetail>> {
    return request<TransactionDetail>(`/api/wallet/transactions/${id}`);
  },

  async fundWallet(payload: WalletFundingPayload): Promise<ApiResult<Transaction>> {
    // Backend remains authoritative for verifying/settling the funding —
    // this only initiates the request.
    return request<Transaction>("/api/payments/initialize", { method: "POST", body: { amount: Number(payload.amount), idempotencyKey: payload.idempotencyKey } });
  },
};
