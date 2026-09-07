import type { ApiResult } from "@app/types/common";
import type {
  AuthSession,
  AuthUser,
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
} from "@app/types/auth";
import type { Transaction, TransactionDetail, WalletBalance, WalletFundingPayload } from "@app/types/wallet";
import type { CreateOrderPayload, DataPlan, Network, Order } from "@app/types/orders";
import type { DeviceInfo, PinStatus, SecurityNotification } from "@app/types/security";

/**
 * ============================================================================
 * MOCK / DEVELOPMENT-ONLY ADAPTER LAYER
 * ============================================================================
 * Everything in this file is fake data for local development when the real
 * backend is unavailable. It is intentionally isolated from services/api.ts
 * and the real adapters (auth.ts, wallet.ts, orders.ts) so it can be deleted
 * or swapped out without touching any UI component.
 *
 * DO NOT reuse these values, this file, or its patterns for production
 * financial logic. No real balance, price, or transaction outcome should
 * ever come from here outside of local development.
 * ============================================================================
 */

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let mockAuthedUser: AuthUser | null = null;

const MOCK_USER: AuthUser = {
  id: "usr_mock_1",
  fullName: "Amina Yusuf",
  email: "amina@example.com",
  phone: "+2348012345678",
  role: "customer",
  createdAt: "2026-01-04T09:00:00.000Z",
};

export const mockAuthService = {
  async register(payload: RegisterPayload): Promise<ApiResult<AuthSession>> {
    await delay(500);
    const user: AuthUser = {
      id: "usr_mock_new",
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      role: payload.role,
      createdAt: new Date().toISOString(),
    };
    mockAuthedUser = user;
    return { ok: true, data: { user, tokens: { accessToken: "mock-token" } } };
  },

  async login(payload: LoginPayload): Promise<ApiResult<AuthSession>> {
    await delay(500);
    if (!payload.email || !payload.password) {
      return { ok: false, error: { code: "VALIDATION", message: "Enter your email and password." } };
    }
    mockAuthedUser = MOCK_USER;
    return { ok: true, data: { user: MOCK_USER, tokens: { accessToken: "mock-token" } } };
  },

  async me(): Promise<ApiResult<AuthUser>> {
    await delay(200);
    if (!mockAuthedUser) {
      return { ok: false, error: { code: "UNAUTHORIZED", message: "Session expired. Please log in again." } };
    }
    return { ok: true, data: mockAuthedUser };
  },

  async forgotPassword(_payload: ForgotPasswordPayload): Promise<ApiResult<{ sent: true }>> {
    await delay(400);
    return { ok: true, data: { sent: true } };
  },

  logout(): void {
    mockAuthedUser = null;
  },
};

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "txn_1",
    reference: "LP-20260901-0001",
    type: "airtime",
    status: "success",
    amount: "500.00",
    description: "MTN Airtime · +2348012345678",
    createdAt: "2026-09-01T08:12:00.000Z",
  },
  {
    id: "txn_2",
    reference: "LP-20260828-0044",
    type: "data",
    status: "success",
    amount: "1200.00",
    description: "Airtel 2GB · +2348023456789",
    createdAt: "2026-08-28T14:30:00.000Z",
  },
  {
    id: "txn_3",
    reference: "LP-20260825-0009",
    type: "wallet_funding",
    status: "pending",
    amount: "5000.00",
    description: "Wallet funding · Bank transfer",
    createdAt: "2026-08-25T10:05:00.000Z",
  },
  {
    id: "txn_4",
    reference: "LP-20260819-0031",
    type: "data",
    status: "failed",
    amount: "3500.00",
    description: "Glo 10GB · +2348034567890",
    createdAt: "2026-08-19T19:47:00.000Z",
  },
];

const fundingIdempotencyCache = new Map<string, Transaction>();

export const mockWalletService = {
  async getBalance(): Promise<ApiResult<WalletBalance>> {
    await delay(300);
    return {
      ok: true,
      data: {
        ngnBalance: "18450.00",
        ngnAvailableBalance: "17450.00",
        ngnPendingBalance: "1000.00",
        ngnHeldBalance: "0.00",
        currency: "NGN",
        updatedAt: new Date().toISOString(),
      },
    };
  },

  async getTransactions(): Promise<ApiResult<Transaction[]>> {
    await delay(400);
    return { ok: true, data: MOCK_TRANSACTIONS };
  },

  async getTransaction(id: string): Promise<ApiResult<TransactionDetail>> {
    await delay(300);
    const base = MOCK_TRANSACTIONS.find((t) => t.id === id);
    if (!base) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Transaction not found." } };
    }
    const detail: TransactionDetail = {
      ...base,
      counterparty: base.type === "airtime" || base.type === "data" ? "+2348012345678" : undefined,
      network: base.type === "airtime" || base.type === "data" ? "MTN" : undefined,
      providerReference: "PRV-" + base.reference,
      failureReason: base.status === "failed" ? "Provider timeout. Amount was reversed." : undefined,
    };
    return { ok: true, data: detail };
  },

  async fundWallet(payload: WalletFundingPayload): Promise<ApiResult<Transaction>> {
    // Idempotency: a repeated key returns the original attempt's result
    // instead of creating a second funding record. The backend is what
    // actually enforces this — this mock only demonstrates the contract.
    const cached = fundingIdempotencyCache.get(payload.idempotencyKey);
    if (cached) return { ok: true, data: cached };

    await delay(600);
    const txn: Transaction = {
      id: "txn_mock_fund_" + payload.idempotencyKey,
      reference: "LP-" + payload.idempotencyKey.slice(0, 8),
      type: "wallet_funding",
      // A redirect/response reaching the frontend is never proof of payment —
      // funding always starts pending until the backend verifies it.
      status: "pending",
      amount: payload.amount,
      description: "Wallet funding · " + payload.method,
      createdAt: new Date().toISOString(),
    };
    fundingIdempotencyCache.set(payload.idempotencyKey, txn);
    return { ok: true, data: txn };
  },
};

const MOCK_NETWORKS: Network[] = [
  { id: "mtn", name: "MTN" },
  { id: "airtel", name: "Airtel" },
  { id: "glo", name: "Glo" },
  { id: "9mobile", name: "9mobile" },
];

const MOCK_PLANS: Record<string, DataPlan[]> = {
  mtn: [
    { id: "mtn_1gb", networkId: "mtn", label: "1GB - 30 days", price: "800.00" },
    { id: "mtn_2gb", networkId: "mtn", label: "2GB - 30 days", price: "1500.00" },
  ],
  airtel: [{ id: "airtel_1_5gb", networkId: "airtel", label: "1.5GB - 30 days", price: "900.00" }],
  glo: [{ id: "glo_1gb", networkId: "glo", label: "1GB - 14 days", price: "700.00" }],
  "9mobile": [{ id: "9m_1gb", networkId: "9mobile", label: "1GB - 30 days", price: "850.00" }],
};

const orderIdempotencyCache = new Map<string, Order>();
/** Orders sitting in auth_required, waiting for the PIN/OTP the frontend collected. */
const pendingVerification = new Map<string, CreateOrderPayload>();

export const mockOrdersService = {
  async getNetworks(): Promise<ApiResult<Network[]>> {
    await delay(200);
    return { ok: true, data: MOCK_NETWORKS };
  },

  async getDataPlans(networkId: string): Promise<ApiResult<DataPlan[]>> {
    await delay(200);
    return { ok: true, data: MOCK_PLANS[networkId] ?? [] };
  },

  async createOrder(payload: CreateOrderPayload): Promise<ApiResult<Order>> {
    const cached = orderIdempotencyCache.get(payload.idempotencyKey);
    if (cached) return { ok: true, data: cached };

    await delay(1200);

    const plan = payload.planId
      ? Object.values(MOCK_PLANS).flat().find((p) => p.id === payload.planId)
      : undefined;
    const baseAmount = plan?.price ?? payload.amount ?? "0.00";
    const fee = "0.00"; // No fee on airtime/data in this mock — real fees are backend-priced.

    // If a verification code came in, this is the step-up response to an
    // earlier VERIFY decision — resolve the order the risk engine already
    // committed to allowing once the challenge is satisfied.
    if (payload.verificationCode) {
      const pending = pendingVerification.get(payload.idempotencyKey);
      if (!pending) {
        return { ok: false, error: { code: "NOT_FOUND", message: "This verification has expired. Please start again." } };
      }
      pendingVerification.delete(payload.idempotencyKey);
      const verified = payload.verificationCode === "1234"; // mock PIN, dev-only
      const order: Order = {
        id: "ord_mock_" + payload.idempotencyKey,
        reference: "LP-" + payload.idempotencyKey.slice(0, 8),
        kind: payload.kind,
        status: verified ? "success" : "failed",
        networkId: payload.networkId,
        phoneNumber: payload.phoneNumber,
        amount: baseAmount,
        fee,
        total: (Number(baseAmount) + Number(fee)).toFixed(2),
        planLabel: plan?.label,
        createdAt: new Date().toISOString(),
        failureReason: verified ? undefined : "Incorrect PIN. Please try again.",
      };
      orderIdempotencyCache.set(payload.idempotencyKey, order);
      return { ok: true, data: order };
    }

    // Simulates the backend risk engine's decision. Real weighting, rules,
    // and thresholds live entirely server-side — this distribution exists
    // only so every UI branch is exercisable in local development.
    const roll = Math.random();
    const riskDecision: import("@app/types/security").RiskDecision =
      roll < 0.6 ? "allow" : roll < 0.8 ? "verify" : roll < 0.92 ? "hold" : "reject";

    if (riskDecision === "verify") {
      pendingVerification.set(payload.idempotencyKey, payload);
      const order: Order = {
        id: "ord_mock_" + payload.idempotencyKey,
        reference: "LP-" + payload.idempotencyKey.slice(0, 8),
        kind: payload.kind,
        status: "auth_required",
        networkId: payload.networkId,
        phoneNumber: payload.phoneNumber,
        amount: baseAmount,
        fee,
        total: (Number(baseAmount) + Number(fee)).toFixed(2),
        planLabel: plan?.label,
        createdAt: new Date().toISOString(),
        riskDecision,
        requiredChallenge: "pin",
      };
      // Not cached under the idempotency key yet — the follow-up call with
      // verificationCode reuses the same key to resolve it.
      return { ok: true, data: order };
    }

    if (riskDecision === "hold") {
      const order: Order = {
        id: "ord_mock_" + payload.idempotencyKey,
        reference: "LP-" + payload.idempotencyKey.slice(0, 8),
        kind: payload.kind,
        status: "held",
        networkId: payload.networkId,
        phoneNumber: payload.phoneNumber,
        amount: baseAmount,
        fee,
        total: (Number(baseAmount) + Number(fee)).toFixed(2),
        planLabel: plan?.label,
        createdAt: new Date().toISOString(),
        riskDecision,
      };
      orderIdempotencyCache.set(payload.idempotencyKey, order);
      return { ok: true, data: order };
    }

    if (riskDecision === "reject") {
      const order: Order = {
        id: "ord_mock_" + payload.idempotencyKey,
        reference: "LP-" + payload.idempotencyKey.slice(0, 8),
        kind: payload.kind,
        status: "failed",
        networkId: payload.networkId,
        phoneNumber: payload.phoneNumber,
        amount: baseAmount,
        fee,
        total: (Number(baseAmount) + Number(fee)).toFixed(2),
        planLabel: plan?.label,
        createdAt: new Date().toISOString(),
        riskDecision,
        failureReason: "This transaction was blocked for your security.",
      };
      orderIdempotencyCache.set(payload.idempotencyKey, order);
      return { ok: true, data: order };
    }

    // allow → normal processing outcome (mostly success, occasionally
    // pending/unknown, to exercise those branches too).
    const outcomeRoll = Math.random();
    const status: Order["status"] =
      outcomeRoll < 0.85 ? "success" : outcomeRoll < 0.95 ? "pending" : "unknown";
    const order: Order = {
      id: "ord_mock_" + payload.idempotencyKey,
      reference: "LP-" + payload.idempotencyKey.slice(0, 8),
      kind: payload.kind,
      status,
      networkId: payload.networkId,
      phoneNumber: payload.phoneNumber,
      amount: baseAmount,
      fee,
      total: (Number(baseAmount) + Number(fee)).toFixed(2),
      planLabel: plan?.label,
      createdAt: new Date().toISOString(),
      riskDecision,
      failureReason:
        status === "unknown"
          ? "We lost the connection while confirming this. We'll update it once it's confirmed — please don't retry yet."
          : undefined,
    };
    orderIdempotencyCache.set(payload.idempotencyKey, order);
    return { ok: true, data: order };
  },

  async getOrder(id: string): Promise<ApiResult<Order>> {
    await delay(300);
    const cached = [...orderIdempotencyCache.values()].find((o) => o.id === id);
    if (cached) return { ok: true, data: cached };
    return {
      ok: true,
      data: {
        id,
        reference: "LP-" + id,
        kind: "airtime",
        status: "success",
        networkId: "mtn",
        phoneNumber: "+2348012345678",
        amount: "500.00",
        fee: "0.00",
        total: "500.00",
        createdAt: new Date().toISOString(),
      },
    };
  },
};

let mockPinStatus: PinStatus = "not_set";
let mockPinAttempts = 0;

const MOCK_DEVICES: DeviceInfo[] = [
  {
    id: "dev_1",
    label: "Chrome on Windows · Lagos",
    lastActiveAt: new Date().toISOString(),
    isCurrent: true,
    trusted: true,
  },
  {
    id: "dev_2",
    label: "Safari on iPhone · Kano",
    lastActiveAt: "2026-08-30T18:22:00.000Z",
    isCurrent: false,
    trusted: true,
  },
];

const MOCK_NOTIFICATIONS: SecurityNotification[] = [
  {
    id: "notif_1",
    category: "device",
    message: "A new device signed in to your LAUPAY account.",
    createdAt: "2026-08-30T18:22:00.000Z",
    read: false,
  },
  {
    id: "notif_2",
    category: "transaction",
    message: "Your data purchase was blocked for security reasons.",
    createdAt: "2026-08-25T10:05:00.000Z",
    read: true,
  },
];

/**
 * Mock security service. PIN checks here are for local UI development only —
 * a real PIN must be verified server-side over a secure connection, never
 * confirmed by frontend JavaScript comparing strings.
 */
export const mockSecurityService = {
  async getPinStatus(): Promise<ApiResult<{ status: PinStatus; attemptsRemaining: number }>> {
    await delay(200);
    return { ok: true, data: { status: mockPinStatus, attemptsRemaining: Math.max(0, 5 - mockPinAttempts) } };
  },

  async createPin(_pin: string): Promise<ApiResult<{ status: PinStatus }>> {
    await delay(400);
    mockPinStatus = "active";
    mockPinAttempts = 0;
    return { ok: true, data: { status: mockPinStatus } };
  },

  async changePin(_currentPin: string, _newPin: string): Promise<ApiResult<{ status: PinStatus }>> {
    await delay(400);
    return { ok: true, data: { status: mockPinStatus } };
  },

  async forgotPin(): Promise<ApiResult<{ sent: true }>> {
    await delay(400);
    return { ok: true, data: { sent: true } };
  },

  async getDevices(): Promise<ApiResult<DeviceInfo[]>> {
    await delay(300);
    return { ok: true, data: MOCK_DEVICES };
  },

  async revokeDevice(deviceId: string): Promise<ApiResult<{ revoked: true }>> {
    await delay(400);
    const idx = MOCK_DEVICES.findIndex((d) => d.id === deviceId);
    if (idx >= 0 && !MOCK_DEVICES[idx]?.isCurrent) MOCK_DEVICES.splice(idx, 1);
    return { ok: true, data: { revoked: true } };
  },

  async getNotifications(): Promise<ApiResult<SecurityNotification[]>> {
    await delay(300);
    return { ok: true, data: MOCK_NOTIFICATIONS };
  },

  async markNotificationRead(id: string): Promise<ApiResult<{ read: true }>> {
    await delay(150);
    const notif = MOCK_NOTIFICATIONS.find((n) => n.id === id);
    if (notif) notif.read = true;
    return { ok: true, data: { read: true } };
  },
};
