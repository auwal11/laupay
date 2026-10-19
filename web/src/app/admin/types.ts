export type AdminRole = "ADMIN" | "SUPPORT";

export interface AdminSession {
  email: string;
  role: AdminRole;
}

export interface AdminLoginResponse {
  accessToken: string;
  refreshToken?: string;
  role: AdminRole;
}

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
  ipAddress: string | null;
  createdAt: string;
  actor: AdminUserSummary | null;
}

export interface AdminOverview {
  fulfillmentMode: string;
  users: { total: number; active: number };
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
  autoTestCredit: { enabled: boolean; amount: number };
  mailProvider: string;
  adminWebOrigin: string;
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
