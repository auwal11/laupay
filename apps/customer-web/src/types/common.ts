/**
 * Cross-cutting types shared by every service module.
 *
 * IMPORTANT: this app never computes prices, balances, or transaction
 * outcomes on its own — every value here is treated as backend-authoritative.
 * The frontend only requests, displays, and reacts to what the API returns.
 */

export type Role = "customer" | "agent";

/** Discriminated result type so callers must handle both branches explicitly. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export interface ApiError {
  /** Machine-readable code the UI can branch on (e.g. "UNAUTHORIZED", "VALIDATION"). */
  code: string;
  /** Human-readable message safe to show to the user as-is. */
  message: string;
  /** Optional per-field validation errors, keyed by field name. */
  fieldErrors?: Record<string, string>;
}

/** Generic loading/error/empty wrapper for any list-shaped screen. */
export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: ApiError }
  | { status: "empty" }
  | { status: "success"; data: T };
