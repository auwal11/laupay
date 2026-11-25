import { adminRequest, buildQuery, downloadAdminCsv } from "./api";
import type { ApiError, ApiResult } from "@app/types/common";
import type {
  AdminAuditEntry,
  AdminDispute,
  AdminDisputeDetail,
  AdminLoginResponse,
  AdminOrder,
  AdminOrderDetail,
  AdminOverview,
  AdminReport,
  AdminStaffRow,
  AdminSettings,
  AdminTransaction,
  AdminUserDetail,
  AdminUserRow,
  AdminWallet,
  Paged,
  RiskEvent,
  AdminWithdrawal,
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

  me(): Promise<ApiResult<{ userId: string; role: string; permissions: string[]; isSuperAdmin: boolean }>> {
    return adminRequest("/admin/me");
  },

  overview(): Promise<ApiResult<AdminOverview>> {
    return adminRequest<AdminOverview>("/admin/overview");
  },

  // ---- Users ----
  users(params: ListParams = {}): Promise<ApiResult<Paged<AdminUserRow>>> {
    return adminRequest<Paged<AdminUserRow>>(`/admin/users${buildQuery(params)}`);
  },

  createStaff(body: { email: string; fullName: string; role: "SUPPORT" | "FINANCE" | "VIEWER"; reason: string }) {
    return adminRequest<{ user: { id: string; email: string; fullName: string; role: string; status: string }; temporaryPassword: string; warning: string }>("/admin/staff", { method: "POST", body });
  },

  staff(params: ListParams = {}): Promise<ApiResult<Paged<AdminStaffRow>>> {
    return adminRequest<Paged<AdminStaffRow>>(`/admin/staff${buildQuery(params)}`);
  },

  revokeStaffAccess(id: string, reason: string): Promise<ApiResult<{ id: string; status: string }>> {
    return adminRequest<{ id: string; status: string }>(`/admin/staff/${id}/revoke`, {
      method: "POST",
      body: { reason },
    });
  },

  changePassword(currentPassword: string, newPassword: string) {
    return adminRequest<{ changed: true }>("/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    });
  },

  user(id: string): Promise<ApiResult<AdminUserDetail>> {
    return adminRequest<AdminUserDetail>(`/admin/users/${id}`);
  },

  setUserStatus(id: string, action: "freeze" | "unfreeze" | "close" | "reopen", reason: string) {
    return adminRequest(`/admin/users/${id}/${action}`, { method: "POST", body: { reason } });
  },

  resetPin(id: string, reason: string) {
    return adminRequest(`/admin/users/${id}/reset-pin`, { method: "POST", body: { reason } });
  },

  forceLogout(id: string, reason: string) {
    return adminRequest(`/admin/users/${id}/force-logout`, { method: "POST", body: { reason } });
  },

  markVerified(id: string, field: "email" | "phone", reason: string) {
    return adminRequest(`/admin/users/${id}/verify`, { method: "POST", body: { field, reason } });
  },

  addNote(id: string, body: string) {
    return adminRequest(`/admin/users/${id}/notes`, { method: "POST", body: { body } });
  },

  setRole(id: string, role: string, reason: string) {
    return adminRequest(`/admin/users/${id}/role`, { method: "POST", body: { role, reason } });
  },

  // ---- Wallets / ledger ----
  creditWallet(body: { userId: string; amount: number; reason: string; note?: string; idempotencyKey?: string }) {
    return adminRequest<{ entryId: string; balanceAfter: string; wasAlreadyApplied: boolean }>(
      "/admin/wallets/credit",
      { method: "POST", body },
    );
  },

  debitWallet(body: { userId: string; amount: number; reason: string; note?: string; idempotencyKey?: string }) {
    return adminRequest<{ entryId: string; balanceAfter: string; wasAlreadyApplied: boolean }>(
      "/admin/wallets/debit",
      { method: "POST", body },
    );
  },

  debitWalletBalance(body: { userId: string; reason: string; note?: string; idempotencyKey?: string }) {
    return adminRequest<{ entryId: string; balanceAfter: string; wasAlreadyApplied: boolean }>(
      "/admin/wallets/debit-balance",
      { method: "POST", body },
    );
  },

  clearTestBalances(body: { reason: string; idempotencyKey: string }) {
    return adminRequest<{
      operationId: string;
      walletsAffected: number;
      usersAffected: number;
      totalRemoved: string;
      entries: Array<{ walletId: string; userId: string; amount: string; entryId: string; alreadyApplied: boolean }>;
    }>("/admin/wallets/clear-test-balances", { method: "POST", body });
  },

  reverseEntry(id: string, reason: string) {
    return adminRequest(`/admin/ledger/${id}/reverse`, { method: "POST", body: { reason } });
  },

  float(): Promise<ApiResult<{ totalCustomerLiabilities: string; walletCount: number; byOwnerType: Array<{ ownerType: string; balance: string }>; currency: string }>> {
    return adminRequest("/admin/finance/float");
  },

  // ---- Transactions ----
  transactions(params: ListParams = {}): Promise<ApiResult<Paged<AdminTransaction>>> {
    return adminRequest<Paged<AdminTransaction>>(`/admin/transactions${buildQuery(params)}`);
  },

  transaction(id: string): Promise<ApiResult<AdminTransaction>> {
    return adminRequest<AdminTransaction>(`/admin/transactions/${id}`);
  },

  // ---- Wallets list ----
  wallets(params: ListParams = {}): Promise<ApiResult<Paged<AdminWallet>>> {
    return adminRequest<Paged<AdminWallet>>(`/admin/wallets${buildQuery(params)}`);
  },

  setWalletStatus(id: string, action: "freeze" | "unfreeze", reason: string): Promise<ApiResult<AdminWallet>> {
    return adminRequest<AdminWallet>(`/admin/wallets/${id}/${action}`, {
      method: "POST",
      body: { reason },
    });
  },

  // ---- Orders ----
  orders(params: ListParams = {}): Promise<ApiResult<Paged<AdminOrder>>> {
    return adminRequest<Paged<AdminOrder>>(`/admin/orders${buildQuery(params)}`);
  },

  order(id: string): Promise<ApiResult<AdminOrderDetail>> {
    return adminRequest<AdminOrderDetail>(`/admin/orders/${id}`);
  },

  retryOrder(id: string) {
    return adminRequest(`/admin/orders/${id}/retry`, { method: "POST" });
  },

  markOrderSuccessful(id: string, reason: string) {
    return adminRequest(`/admin/orders/${id}/mark-successful`, { method: "POST", body: { reason } });
  },

  markOrderFailed(id: string, reason: string) {
    return adminRequest(`/admin/orders/${id}/mark-failed`, { method: "POST", body: { reason } });
  },

  openDisputeFromOrder(id: string, reason: string, details?: string) {
    return adminRequest(`/admin/orders/${id}/dispute`, { method: "POST", body: { reason, details } });
  },

  // ---- Disputes ----
  disputes(params: ListParams = {}): Promise<ApiResult<Paged<AdminDispute>>> {
    return adminRequest<Paged<AdminDispute>>(`/admin/disputes${buildQuery(params)}`);
  },

  dispute(id: string): Promise<ApiResult<AdminDisputeDetail>> {
    return adminRequest<AdminDisputeDetail>(`/admin/disputes/${id}`);
  },

  assignDispute(id: string, adminId: string, reason: string) {
    return adminRequest(`/admin/disputes/${id}/assign`, { method: "POST", body: { adminId, reason } });
  },

  addDisputeMessage(id: string, body: string, internal?: boolean) {
    return adminRequest(`/admin/disputes/${id}/messages`, { method: "POST", body: { body, internal } });
  },

  refundDispute(id: string, reason: string, note?: string) {
    return adminRequest(`/admin/disputes/${id}/refund`, { method: "POST", body: { reason, note } });
  },

  rejectDispute(id: string, reason: string, note?: string) {
    return adminRequest(`/admin/disputes/${id}/reject`, { method: "POST", body: { reason, note } });
  },

  updateDispute(id: string, status: string, reason: string): Promise<ApiResult<AdminDispute>> {
    return adminRequest<AdminDispute>(`/admin/disputes/${id}`, { method: "PATCH", body: { status, reason } });
  },

  // ---- Audit ----
  audit(params: ListParams = {}): Promise<ApiResult<Paged<AdminAuditEntry>>> {
    return adminRequest<Paged<AdminAuditEntry>>(`/admin/audit${buildQuery(params)}`);
  },

  // ---- Settings ----
  settings(): Promise<ApiResult<AdminSettings>> {
    return adminRequest<AdminSettings>("/admin/settings");
  },

  updateSettingsV2(settings: Record<string, string>, reason: string): Promise<ApiResult<AdminSettings>> {
    return adminRequest<AdminSettings>("/admin/settings/update", {
      method: "POST",
      body: { settings, reason },
    });
  },

  killSwitch(key: string, paused: boolean, reason: string) {
    return adminRequest("/admin/settings/kill-switch", {
      method: "POST",
      body: { key, paused, reason },
    });
  },

  providerMode(mode: string, reason: string, confirmation?: string) {
    return adminRequest("/admin/settings/provider-mode", {
      method: "POST",
      body: { mode, reason, confirmation },
    });
  },

  // ---- Risk ----
  riskEvents(params: ListParams = {}): Promise<ApiResult<Paged<RiskEvent>>> {
    return adminRequest<Paged<RiskEvent>>(`/admin/risk/events${buildQuery(params)}`);
  },

  withdrawals(params: ListParams = {}): Promise<ApiResult<AdminWithdrawal[]>> {
    return adminRequest<AdminWithdrawal[]>(`/admin/withdrawals${buildQuery(params)}`);
  },
  withdrawal(id: string): Promise<ApiResult<AdminWithdrawal & { events: Array<{ action: string; fromStatus?: string; toStatus: string; reason?: string; createdAt: string }> }>> {
    return adminRequest(`/admin/withdrawals/${id}`);
  },
  withdrawalAction(id: string, action: "approve" | "process" | "successful" | "failed" | "reject" | "refund", body: Record<string, string>) {
    return adminRequest(`/admin/withdrawals/${id}/${action}`, { method: "POST", body });
  },

  blacklistPhone(phone: string, reason: string) {
    return adminRequest("/admin/risk/blacklist", { method: "POST", body: { phone, reason } });
  },

  unblacklistPhone(phone: string, reason: string) {
    return adminRequest("/admin/risk/blacklist", { method: "DELETE", body: { phone, reason } });
  },

  // ---- Reports ----
  supportTickets(params: ListParams = {}) {
    return adminRequest<any[]>(`/admin/support/tickets${buildQuery(params)}`);
  },

  supportTicket(id: string) {
    return adminRequest<any>(`/admin/support/tickets/${id}`);
  },

  updateSupportTicket(id: string, body: Record<string, unknown>) {
    return adminRequest<any>(`/admin/support/tickets/${id}`, { method: "POST", body });
  },

  report(from?: string, to?: string): Promise<ApiResult<AdminReport>> {
    return adminRequest<AdminReport>(`/admin/reports/summary${buildQuery({ from, to })}`);
  },

  reconciliation(from?: string, to?: string): Promise<ApiResult<AdminReport>> {
    return adminRequest<AdminReport>(`/admin/reports/reconciliation${buildQuery({ from, to })}`);
  },

  runReconciliation(): Promise<ApiResult<{ paymentsChecked: number; vtuChecked: number; ordersTimedOut: number; paymentsExpired: number }>> {
    return adminRequest("/admin/reconciliation/run", { method: "POST" });
  },

  exportOrdersCsv(params: ListParams = {}): Promise<ApiError | null> {
    return downloadAdminCsv(`/admin/orders/export${buildQuery(params)}`, "laupay-orders.csv");
  },

  exportTransactionsCsv(params: ListParams = {}): Promise<ApiError | null> {
    return downloadAdminCsv(`/admin/transactions/export${buildQuery(params)}`, "laupay-transactions.csv");
  },

  // ---- Test credit ----
  creditTestFunds(
    body: { userId: string; amount: number; idempotencyKey?: string },
  ): Promise<ApiResult<{ entryId: string; balanceAfter: string; wasAlreadyApplied: boolean }>> {
    return adminRequest("/admin/credits/test", { method: "POST", body });
  },
};
