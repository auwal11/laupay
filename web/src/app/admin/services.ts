import { adminRequest, buildQuery } from "./api";
import type { ApiResult } from "@app/types/common";
import type {
  AdminAuditEntry,
  AdminLoginResponse,
  AdminOrder,
  AdminOverview,
  AdminSettings,
  AdminTransaction,
  AdminUserRow,
  AdminWallet,
  Paged,
} from "./types";

interface ListParams {
  [key: string]: string | number | undefined | null;
}

/**
 * Typed adapter over the admin API. Paths are relative to VITE_API_BASE_URL
 * (which already includes `/api`). Every figure returned is
 * backend-authoritative; the console never computes balances itself.
 */
export const adminService = {
  login(email: string, password: string): Promise<ApiResult<AdminLoginResponse>> {
    return adminRequest<AdminLoginResponse>("/admin/login", {
      method: "POST",
      body: { email, password },
    });
  },

  overview(): Promise<ApiResult<AdminOverview>> {
    return adminRequest<AdminOverview>("/admin/overview");
  },

  users(params: ListParams = {}): Promise<ApiResult<Paged<AdminUserRow>>> {
    return adminRequest<Paged<AdminUserRow>>(`/admin/users${buildQuery(params)}`);
  },

  user(id: string): Promise<ApiResult<AdminUserRow & { orders: AdminOrder[]; transactions: AdminTransaction[] }>> {
    return adminRequest(`/admin/users/${id}`);
  },

  transactions(params: ListParams = {}): Promise<ApiResult<Paged<AdminTransaction>>> {
    return adminRequest<Paged<AdminTransaction>>(`/admin/transactions${buildQuery(params)}`);
  },

  transaction(id: string): Promise<ApiResult<AdminTransaction>> {
    return adminRequest<AdminTransaction>(`/admin/transactions/${id}`);
  },

  wallets(params: ListParams = {}): Promise<ApiResult<Paged<AdminWallet>>> {
    return adminRequest<Paged<AdminWallet>>(`/admin/wallets${buildQuery(params)}`);
  },

  orders(params: ListParams = {}): Promise<ApiResult<Paged<AdminOrder>>> {
    return adminRequest<Paged<AdminOrder>>(`/admin/orders${buildQuery(params)}`);
  },

  audit(params: ListParams = {}): Promise<ApiResult<Paged<AdminAuditEntry>>> {
    return adminRequest<Paged<AdminAuditEntry>>(`/admin/audit${buildQuery(params)}`);
  },

  settings(): Promise<ApiResult<AdminSettings>> {
    return adminRequest<AdminSettings>("/admin/settings");
  },

  updateSettings(
    body: { autoTestCreditEnabled?: boolean; autoTestCreditAmount?: number },
  ): Promise<ApiResult<AdminSettings>> {
    return adminRequest<AdminSettings>("/admin/settings", { method: "PATCH", body });
  },

  creditTestFunds(
    body: { userId: string; amount: number; idempotencyKey?: string },
  ): Promise<ApiResult<{ entryId: string; balanceAfter: string; wasAlreadyApplied: boolean }>> {
    return adminRequest("/admin/credits/test", { method: "POST", body });
  },

  setWalletStatus(
    id: string,
    action: "freeze" | "unfreeze",
  ): Promise<ApiResult<AdminWallet>> {
    return adminRequest<AdminWallet>(`/admin/wallets/${id}/${action}`, { method: "POST" });
  },
};
