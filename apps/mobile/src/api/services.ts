import { request } from './http';

export type AuthTokens = { accessToken: string; refreshToken: string };
export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  profilePhotoUrl?: string | null;
  role: string;
  status: string;
};
export type RegistrationResult = { requiresVerification: true; email: string; message: string };
export type Wallet = { id: string; balance: string | number; currency: string; status: string };
export type LedgerEntry = {
  id: string;
  amount: string | number;
  direction: 'credit' | 'debit' | string;
  reason: string;
  referenceId?: string | null;
  referenceType?: string | null;
  createdAt: string;
  status: string;
  description: string;
  balanceBefore?: string;
  balanceAfter?: string;
  network?: string;
  counterparty?: string;
  orderType?: string;
};
export type Network = { id: string; code: string; name: string };
export type DataPlan = { id: string; networkId: string; label: string; priceNaira: string | number; validityDays?: number | null };
export type Order = {
  id: string;
  type: string;
  status: string;
  amount: string | number;
  network?: string | null;
  phoneNumber?: string | null;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
  idempotencyKey?: string;
};
export type VirtualAccount = { accountNumber: string; bankName: string; accountName: string; providerReference?: string | null };
export type Notification = { id: string; category: string; title: string; body: string; readAt?: string | null; createdAt: string; metadata?: Record<string, unknown> };
export type PinStatus = { hasPin: boolean; locked: boolean; lockedUntil: string | null };
export type Bank = { code: string; name: string };
export type Withdrawal = { id: string; reference: string; amount: string | number; bankName: string; accountName: string; accountNumber: string; status: string; createdAt: string; failureReason?: string | null };
export type SupportTicket = { id: string; ticketNumber?: string; category: string; subject: string; description?: string; status: string; createdAt: string; updatedAt?: string };
export type Dispute = { id: string; caseReference: string; reason: string; status: string; createdAt: string };

export const authApi = {
  register: (payload: { email: string; password: string; fullName: string; phone: string; termsAccepted: true; termsVersion: string }) =>
    request<RegistrationResult>('/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (email: string, password: string) => request<AuthTokens>('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  verifyEmail: (email: string, code: string) => request<AuthTokens>('/auth/verify-otp', { method: 'POST', body: { email, code }, auth: false }),
  resendEmailCode: (email: string) => request<{ sent: true; message: string }>('/auth/resend-otp', { method: 'POST', body: { email }, auth: false }),
  forgotPassword: (email: string) => request<{ sent: true; message?: string }>('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  resetPassword: (token: string, password: string) => request<{ reset: true }>('/auth/reset-password', { method: 'POST', body: { token, password }, auth: false }),
  changePassword: (currentPassword: string, newPassword: string) => request<{ changed: true }>('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
  me: () => request<UserProfile>('/auth/me'),
  logout: (refreshToken: string) => request<{ loggedOut?: boolean }>('/auth/logout', { method: 'POST', body: { refreshToken }, retryAfterRefresh: false }),
};

export const walletApi = {
  getWallet: () => request<Wallet>('/wallet'),
  getTransactions: () => request<LedgerEntry[]>('/wallet/transactions'),
  getTransaction: (id: string) => request<LedgerEntry>(`/wallet/transactions/${encodeURIComponent(id)}`),
};

export const catalogApi = {
  networks: () => request<Network[]>('/catalog/networks'),
  dataPlans: (networkCode: string) => request<DataPlan[]>(`/catalog/data-plans/${encodeURIComponent(networkCode)}`),
};

export const ordersApi = {
  airtime: (payload: { network: string; phoneNumber: string; amount: number; idempotencyKey: string; pin: string }) =>
    request<Order>('/orders/airtime', { method: 'POST', body: payload }),
  data: (payload: { network: string; phoneNumber: string; dataPlanId: string; idempotencyKey: string; pin: string }) =>
    request<Order>('/orders/data', { method: 'POST', body: payload }),
  list: () => request<Order[]>('/orders'),
  detail: (id: string) => request<Order>(`/orders/${encodeURIComponent(id)}`),
};

export const paymentsApi = {
  initialize: (amount: number, idempotencyKey: string) =>
    request<{ id: string; status: string; amount: string | number; providerName?: string; checkoutUrl?: string; providerReference?: string }>('/payments/initialize', {
      method: 'POST', body: { amount, idempotencyKey },
    }),
  virtualAccount: async () => (await request<{ account: VirtualAccount | null }>('/payments/virtual-account')).account,
  ensureVirtualAccount: (bvn?: string) => request<VirtualAccount>('/payments/virtual-account', { method: 'POST', body: bvn ? { bvn } : {} }),
};

export const withdrawalsApi = {
  banks: () => request<Bank[]>('/withdrawals/banks'),
  list: () => request<Withdrawal[]>('/withdrawals'),
  detail: (id: string) => request<Withdrawal>(`/withdrawals/${encodeURIComponent(id)}`),
  create: (payload: { amount: number; bankName: string; bankCode: string; accountName: string; accountNumber: string; pin: string; idempotencyKey: string }) => request<Withdrawal>('/withdrawals', { method: 'POST', body: payload }),
};

export const profileApi = {
  get: () => request<UserProfile>('/users/me'),
  update: (payload: { fullName?: string; phone?: string }) => request<UserProfile>('/users/me', { method: 'PATCH', body: payload }),
};

export const securityApi = {
  pinStatus: () => request<PinStatus>('/security/pin/status'),
  setPin: (pin: string) => request<{ hasPin: true }>('/security/pin', { method: 'POST', body: { pin } }),
  changePin: (currentPin: string, newPin: string) => request<{ hasPin: true }>('/security/pin/change', { method: 'POST', body: { currentPin, newPin } }),
  devices: () => request<{ id: string; label: string; lastActiveAt: string; isCurrent: boolean; trusted: boolean }[]>('/security/devices'),
  revokeDevice: (id: string) => request<{ revoked: boolean }>(`/security/devices/${encodeURIComponent(id)}/revoke`, { method: 'POST' }),
  notifications: () => request<{ id: string; category?: string; title?: string; body?: string; createdAt?: string; read?: boolean }[]>('/security/notifications'),
};

export const notificationsApi = {
  list: () => request<Notification[]>('/notifications'),
  unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => request<{ read: boolean }>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }),
  markAllRead: () => request<{ read: number }>('/notifications/read-all', { method: 'POST' }),
};

export const supportApi = {
  list: () => request<SupportTicket[]>('/support/tickets'),
  detail: (id: string) => request<SupportTicket & { messages?: { body: string; createdAt: string; authorType?: string }[] }>(`/support/tickets/${encodeURIComponent(id)}`),
  create: (payload: { contactEmail: string; contactName: string; category: string; subject: string; description: string }) => request<{ ticketNumber: string; status: string; createdAt: string }>('/support/tickets/me', { method: 'POST', body: payload }),
  reply: (id: string, body: string) => request<unknown>(`/support/tickets/${encodeURIComponent(id)}/replies`, { method: 'POST', body: { body } }),
};

export const disputesApi = {
  list: () => request<Dispute[]>('/disputes'),
  create: (transactionId: string, reason: string, details?: string) => request<Dispute>('/disputes', { method: 'POST', body: { transactionId, reason, ...(details ? { details } : {}) } }),
};
