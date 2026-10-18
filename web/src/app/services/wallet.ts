import { request } from "./api";
import type { ApiResult } from "@app/types/common";
import type { Transaction, TransactionDetail, WalletBalance, WalletFundingPayload } from "@app/types/wallet";

/**
 * Real adapter for the backend wallet + payments modules. Every figure is
 * backend/ledger-authoritative — the frontend never derives a balance. Paths
 * are relative to VITE_API_BASE_URL (which already includes the `/api`).
 */
export const walletService = {
  async getBalance(): Promise<ApiResult<WalletBalance>> {
    return request<BackendWallet>("/wallet").then((result) =>
      result.ok
        ? {
            ok: true,
            data: {
              ngnBalance: String(result.data.balance ?? result.data.ngnBalance ?? "0"),
              ngnAvailableBalance: String(
                result.data.balance ?? result.data.ngnAvailableBalance ?? "0",
              ),
              currency: "NGN",
              updatedAt: result.data.updatedAt ?? new Date().toISOString(),
            },
          }
        : result,
    );
  },

  async getTransactions(): Promise<ApiResult<Transaction[]>> {
    return request<BackendLedgerEntry[]>("/wallet/transactions").then((result) =>
      result.ok ? { ok: true, data: result.data.map(normalizeTransaction) } : result,
    );
  },

  async getTransaction(id: string): Promise<ApiResult<TransactionDetail>> {
    // The backend exposes the ledger as a list only; derive the single entry
    // client-side rather than assuming a dedicated endpoint exists.
    const result = await this.getTransactions();
    if (!result.ok) return result;
    const found = result.data.find((t) => t.id === id);
    return found
      ? { ok: true, data: found }
      : { ok: false, error: { code: "NOT_FOUND", message: "Transaction not found." } };
  },

  async fundWallet(payload: WalletFundingPayload): Promise<ApiResult<Transaction>> {
    // Backend remains authoritative for verifying/settling the funding —
    // this only initiates the request.
    return request<BackendPayment>("/payments/initialize", {
      method: "POST",
      body: { amount: Number(payload.amount), idempotencyKey: payload.idempotencyKey },
    }).then((result) =>
      result.ok
        ? {
            ok: true,
            data: {
              id: result.data.id,
              reference: result.data.providerReference ?? result.data.id,
              type: "wallet_funding",
              status:
                String(result.data.status).toLowerCase() === "success" ? "success" : "pending",
              amount: String(result.data.amount),
              description: "Wallet funding",
              createdAt: result.data.createdAt ?? new Date().toISOString(),
            },
          }
        : result,
    );
  },
};

interface BackendWallet {
  balance?: string | number;
  ngnBalance?: string | number;
  ngnAvailableBalance?: string | number;
  updatedAt?: string;
}

interface BackendLedgerEntry {
  id: string;
  amount: string | number;
  direction: string; // "CREDIT" | "DEBIT"
  referenceId?: string | null;
  createdAt: string;
}

interface BackendPayment {
  id: string;
  status: string;
  amount: string | number;
  providerReference?: string | null;
  createdAt?: string;
}

function normalizeTransaction(entry: BackendLedgerEntry): Transaction {
  const isCredit = entry.direction === "CREDIT";
  return {
    id: entry.id,
    reference: entry.referenceId ?? entry.id,
    type: isCredit ? "wallet_funding" : "wallet_debit",
    status: "success",
    amount: String(entry.amount),
    description: isCredit ? "Wallet credit" : "Wallet debit",
    createdAt: entry.createdAt,
  };
}
