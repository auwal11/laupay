export type AdminRole = "ADMIN" | "SUPPORT" | "FINANCE" | "VIEWER";

export interface AdminSession {
  email: string;
  role: AdminRole;
  permissions?: string[];
  mustChangePassword?: boolean;
  isSuperAdmin?: boolean;
  userId?: string;
}

export interface AdminLoginResponse {
  accessToken: string;
  refreshToken?: string;
  role: AdminRole;
  permissions?: string[];
  mustChangePassword?: boolean;
}

export type AdminPermission =
  | "overview.read" | "users.read" | "users.freeze" | "users.credit" | "users.manage"
  | "wallets.read" | "wallets.adjust" | "wallets.clear_test_balances" | "ledger.reverse" | "orders.read" | "orders.settle"
  | "disputes.read" | "disputes.manage" | "disputes.refund" | "audit.read"
  | "settings.read" | "settings.write" | "providers.switch_live"
  | "reports.read" | "risk.read" | "risk.manage" | "admins.manage";

export interface Paged<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

export interface AdminUserWallet {
  id: string;
  balance: string;
  status: string;
  currency: string;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  status: string;
  createdAt?: string;
}

export interface AdminUserRow {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  role: string;
  status: string;
  profilePhotoUrl: string | null;
  testCreditGrantedAt: string | null;
  createdAt: string;
  walletAccount: AdminUserWallet | null;
  hasPin: boolean;
}

export interface AdminStaffRow {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  status: string;
  createdAt: string;
  updatedAt: string;
  isSuperAdmin: boolean;
}

export interface AdminTransaction {
  id: string;
  createdAt: string;
  direction: "CREDIT" | "DEBIT";
  amount: string;
  balanceAfter: string;
  reason: string;
  narrative: string | null;
  source: string | null;
  mode: string | null;
  adminId: string | null;
  referenceType: string | null;
  referenceId: string | null;
  walletId: string | null;
  currency: string;
  user: AdminUserSummary | null;
  relatedOrder?: AdminOrder | null;
}

export interface AdminOrder {
  id: string;
  userId: string;
  type: string;
  status: string;
  network: string | null;
  phoneNumber: string | null;
  amount: string;
  mode: string | null;
  createdAt: string;
  user?: AdminUserSummary | null;
  vtuTransaction?: { id: string; status: string; provider: string; providerReference: string | null } | null;
}

export interface AdminWallet {
  id: string;
  ownerId: string;
  ownerType: string;
  balance: string;
  currency: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  user?: (AdminUserSummary & { status?: string }) | null;
}

export interface AdminAuditEntry {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  reason?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  userAgent?: string | null;
  ipAddress: string | null;
  createdAt: string;
  actor: AdminUserSummary | null;
}

export interface ProviderHealth {
  window: string;
  vtu: { provider: string; mode: string; total: number; success: number; failed: number; unknown: number; processing: number };
  payments: { provider: string; success: number; failed: number; pending: number };
  successRate: number | null;
  failureCount: number;
  avgLatencyMs: number | null;
}

export interface RiskEvent {
  id: string;
  userId: string | null;
  type: string;
  severity: string;
  decision: string | null;
  amount: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user?: AdminUserSummary | null;
}

export interface AdminOverview {
  fulfillmentMode: string;
  users: { total: number; active: number; pendingVerification?: number; blocked?: number };
  providerHealth?: ProviderHealth;
  attention?: {
    pendingPayments: number;
    stuckOrders: number;
    openDisputes: number;
    failedVtu24h: number;
    criticalRiskToday: number;
  };
  riskEventsToday?: RiskEvent[];
  wallets: { total: number; aggregateBalance: string; currency: string };
  orders: { total: number; byStatus: Record<string, number> };
  payments: { pendingOrUnknown: number };
  ledger: { totalCredits: string; totalDebits: string; entriesToday: number };
  providers: Record<string, string | boolean>;
  recentUsers: AdminUserSummary[];
  recentTransactions: AdminTransaction[];
}

export interface AdminSettings {
  fulfillmentMode: string;
  providers: Record<string, string | boolean>;
  mailProvider: string;
  adminWebOrigin: string;
  settings?: Record<string, string>;
  effective?: { fulfillmentMode: string; paymentProvider: string };
  blacklist?: string[];
}

export interface AdminDispute {
  id: string;
  caseReference: string;
  userId: string;
  ledgerEntryId: string;
  reason: string;
  details: string | null;
  status: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  userName: string;
  userEmail: string;
  userPhone: string | null;
  amount: string;
  direction: string;
  ledgerReason: string;
  referenceId: string | null;
  transactionCreatedAt: string;
}


export interface AdminUserDetail extends AdminUserRow {
  walletAccount: (AdminUserWallet & { id: string }) | null;
  orders: AdminOrder[];
  transactions: AdminTransaction[];
  disputes: AdminDispute[];
  notes: Array<{ id: string; body: string; createdAt: string; admin: { id: string; email: string; fullName: string } | null }>;
  riskEvents: RiskEvent[];
  sessions: Array<{ id: string; createdAt: string; expiresAt: string }>;
  emailVerified: boolean;
  phoneVerified: boolean;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
  pinSetAt?: string | null;
  pinLockedUntil?: string | null;
  failedPinAttempts?: number;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  updatedAt?: string;
  frozenReason?: string | null;
}

export interface AdminOrderDetail extends AdminOrder {
  failureReason?: string | null;
  settledBy?: string | null;
  settledAt?: string | null;
  dataPlan?: { id: string; label: string; externalCode: string; priceNaira: string } | null;
  payments?: Array<{ id: string; status: string; amount: string; providerName: string | null; providerReference: string | null }>;
  vtuTransaction?: {
    id: string;
    status: string;
    provider: string;
    providerReference: string | null;
    rawResponse: unknown;
    createdAt: string;
    updatedAt: string;
  } | null;
  ledgerEntries: Array<{ id: string; direction: string; amount: string; balanceAfter: string; reason: string; narrative: string | null; createdAt: string }>;
  user?: (AdminUserSummary & { status?: string }) | null;
}

export interface AdminDisputeDetail extends AdminDispute {
  messages: Array<{ id: string; authorType: string; authorId: string | null; body: string; internal: boolean; createdAt: string }>;
  assignedAdmin?: { id: string; email: string; fullName: string } | null;
  ledgerEntry: { id: string; direction: string; amount: string; balanceAfter: string; reason: string; createdAt: string; referenceType: string | null; referenceId: string | null };
  order?: AdminOrder | null;
  assignedAdminId?: string | null;
  resolutionNote?: string | null;
  refundEntryId?: string | null;
  lastActivityAt?: string;
}

export interface AdminReport {
  range: { from: string; to: string };
  fulfilled: { count: number; amount: string };
  refunded: { count: number; amount: string };
  failedCount: number;
  byType: Array<{ type: string; count: number; amount: string }>;
  ledger: { debits: string; credits: string };
}

export interface AdminWithdrawal {
  id: string; reference: string; amount: string; fee: string; bankName: string;
  accountName: string; accountNumber: string; status: string; failureReason?: string;
  refundAmount?: string; refundStatus?: string; providerReference?: string;
  createdAt: string; updatedAt: string; user?: { id: string; email: string; fullName: string };
}
