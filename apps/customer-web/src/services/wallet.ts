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
      data: result.data.map((entry: any): Transaction => ({ id: entry.id, reference: entry.referenceId ?? entry.id, type: entry.orderType === "airtime" ? "airtime" : entry.orderType === "data" ? "data" : entry.reason === "WALLET_FUNDING" ? "wallet_funding" : "wallet_debit", status: entry.status ?? "success", amount: String(entry.amount), description: entry.description ?? `${entry.direction === "credit" ? "Wallet credit" : "Wallet debit"}`, createdAt: entry.createdAt, direction: entry.direction, counterparty: entry.counterparty, network: entry.network })),
    } : result);
  },

  async getTransaction(id: string): Promise<ApiResult<TransactionDetail>> {
    return request<any>(`/api/wallet/transactions/${id}`).then((result) => result.ok ? { ok: true, data: mapLedgerEntry(result.data) } : result);
  },

  async fundWallet(payload: WalletFundingPayload): Promise<ApiResult<Transaction>> {
    // Backend remains authoritative for verifying/settling the funding —
    // this only initiates the request.
    return request<Transaction>("/api/payments/initialize", { method: "POST", body: { amount: Number(payload.amount), idempotencyKey: payload.idempotencyKey } });
  },
};

function mapLedgerEntry(entry: any): TransactionDetail {
  return { id: entry.id, reference: entry.referenceId ?? entry.id, type: entry.orderType === "airtime" ? "airtime" : entry.orderType === "data" ? "data" : entry.direction?.toLowerCase() === "credit" ? "wallet_funding" : "wallet_debit", status: entry.status ?? "success", amount: String(entry.amount), description: entry.description ?? (entry.reason === "ORDER_PAYMENT" ? "Service purchase" : entry.direction?.toLowerCase() === "credit" ? "Wallet credit" : "Wallet debit"), createdAt: entry.createdAt, providerReference: entry.providerReference, direction: entry.direction?.toLowerCase(), counterparty: entry.counterparty, network: entry.network, failureReason: entry.failureReason };
}
