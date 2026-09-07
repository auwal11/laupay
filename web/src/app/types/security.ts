/**
 * Security-architecture types (see LAUPAY Security Architecture V1).
 *
 * These describe UI-visible states only. Every decision here — risk,
 * device trust, transaction outcome — is made by the backend; the
 * frontend just renders whichever of these states the API returns.
 */

/** Full transaction state machine. UI must never infer SUCCESS from a 2xx alone. */
export type TransactionState =
  | "created"
  | "pending"
  | "auth_required"
  | "processing"
  | "success"
  | "failed"
  | "unknown"
  | "cancelled"
  | "held";

/** Backend risk decision for a transaction intent. */
export type RiskDecision = "allow" | "verify" | "hold" | "reject";

/** Step-up challenge the backend asks the frontend to render. */
export type VerificationChallenge = "pin" | "otp" | "device";

export type PinStatus = "not_set" | "active" | "locked";

export interface DeviceInfo {
  id: string;
  label: string; // e.g. "Chrome on Windows — Lagos"
  lastActiveAt: string;
  isCurrent: boolean;
  trusted: boolean;
}

export type NotificationCategory = "account" | "transaction" | "payment" | "device" | "verification";

export interface SecurityNotification {
  id: string;
  category: NotificationCategory;
  message: string;
  createdAt: string;
  read: boolean;
}

/** Session lifecycle, distinct from "no session yet" (anonymous). */
export type SessionStatus =
  | "checking"
  | "authenticated"
  | "anonymous"
  | "session_expired"
  | "session_revoked";

export interface PaymentState {
  status: "initialized" | "pending" | "verified" | "failed" | "unknown";
  reference: string;
}
