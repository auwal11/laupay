import type { RiskDecision, TransactionState, VerificationChallenge } from "./security";

export type PurchaseKind = "airtime" | "data";

export interface Network {
  id: string;
  name: string; // e.g. "MTN", "Airtel", "Glo", "9mobile"
}

export interface DataPlan {
  id: string;
  networkId: string;
  label: string; // e.g. "1.5GB - 30 days"
  /** Backend-authoritative price. Never computed on the frontend. */
  price: string;
}

export interface CreateOrderPayload {
  kind: PurchaseKind;
  networkId: string;
  phoneNumber: string;
  /** Required for airtime; ignored for data (use planId instead). */
  amount?: string;
  /** Required for data. */
  planId?: string;
  /**
   * Client-generated, unique per purchase attempt. Lets the backend
   * de-duplicate retries/double-taps — the backend enforces this, the
   * frontend only supplies the key and disables the button meanwhile.
   */
  idempotencyKey: string;
  /**
   * The account's 4-digit transaction PIN. The backend verifies it (and
   * enforces its lockout policy) before it creates or debits anything, so a
   * purchase cannot be authorized without it. Never logged or persisted here.
   */
  pin: string;
}

/** Alias kept for readability at call sites; same state machine as TransactionState. */
export type OrderStatus = TransactionState;

export interface Order {
  id: string;
  reference: string;
  kind: PurchaseKind;
  status: OrderStatus;
  networkId: string;
  phoneNumber: string;
  /** Backend-authoritative final price — the only price ever shown as final. */
  amount: string;
  fee?: string;
  total?: string;
  planLabel?: string;
  createdAt: string;
  failureReason?: string;
  /** Present when status is auth_required — backend's risk decision and required challenge. */
  riskDecision?: RiskDecision;
  requiredChallenge?: VerificationChallenge;
}

