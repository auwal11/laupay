/**
 * Generates a client-side idempotency key for a single purchase/funding
 * attempt. This is a de-duplication hint for the backend, NOT a security
 * mechanism — the backend remains responsible for actually enforcing
 * idempotency and rejecting/collapsing duplicate submissions.
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older browsers).
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
