# Payment Flow

## 1. Payment States

```
PENDING → PROCESSING → SUCCESS
                     └→ FAILED
                     └→ UNKNOWN → (requery) → SUCCESS | FAILED | UNKNOWN
```

- **PENDING** — created, not yet sent to a provider (or, for agent cash, not
  yet confirmed by the agent).
- **PROCESSING** — sent to provider, awaiting a definitive response.
- **SUCCESS** — provider confirmed success. Wallet has been credited exactly
  once (idempotency-guarded).
- **FAILED** — provider confirmed failure. No wallet mutation occurred (or,
  if a debit had provisionally happened, it has been reversed).
- **UNKNOWN** — provider did not give a definitive answer in time (timeout,
  network error, ambiguous response). **This is not a failure.** The system
  must not credit or fail the payment based on an UNKNOWN result alone.

A payment MUST NOT transition directly from PENDING/PROCESSING to a wallet
credit without passing through SUCCESS. A payment MUST NOT be marked FAILED
purely because of a client/network timeout talking to the provider — the
correct transition in that case is to UNKNOWN.

## 2. Why "timeout is not failed"

If a debit-card charge or bank transfer actually succeeded on the provider's
side but our HTTP call to them timed out before we got the response, marking
it FAILED would cause the customer to be charged with nothing credited to
their wallet - a silent loss for the customer and a support/chargeback
nightmare. UNKNOWN exists specifically to prevent this class of bug.

## 3. Reconciliation

Payments left in `PROCESSING` or `UNKNOWN` beyond a short threshold are
picked up by a reconciliation routine that:

1. Calls the provider's `verifyTransaction()` / status-query endpoint
   (requery) using the original provider reference.
2. Maps the provider's authoritative status onto our state machine.
3. Applies the same idempotent ledger credit primitive used by the normal
   webhook path - so whether the payment resolves via webhook or via
   requery, the wallet is credited exactly once either way.

This routine is provider-agnostic - it only depends on
`PaymentProvider.verifyTransaction()` being implemented, which
`MockPaymentProvider` also implements (see section 5).

## 4. Webhook Handling

`POST /webhooks/payment`:

1. Verify the provider's signature (via a provider-specific
   `WebhookVerifier` - never trust an unsigned/unverified payload).
2. Look up the payment by the provider's transaction reference.
3. Compute an idempotency key from `{provider}:{providerEventId}` and record
   the raw event in `PaymentEvent` (append-only, for audit/debugging) before
   doing anything else - if this exact event was already recorded, stop; it's
   a duplicate delivery (providers commonly retry webhooks).
4. Only then apply the state transition + ledger credit, through the same
   idempotent `LedgerService.credit()` primitive described in
   `wallet-ledger-model.md`. Even if step 3's dedup were somehow bypassed,
   the ledger's own idempotency key would still prevent a double-credit.

## 5. Agent Cash Confirmation

Agent cash collection reuses the same state machine, with `PENDING to SUCCESS`
driven by the agent explicitly confirming "cash received" in the app rather
than a provider webhook. The `Payment.method` field distinguishes
`PROVIDER` vs `AGENT_CASH` so admin/reconciliation tooling can treat them
differently (e.g. agent cash needs no provider reconciliation, but does need
end-of-day agent float reconciliation).

## 6. Mock Provider Behavior

`MockPaymentProvider` (used for all development, per the zero-cost
requirement) deliberately simulates the full range of real-world outcomes so
every code path above is exercised in tests without a live provider:

- Amount ending in `.00` -> SUCCESS
- Amount ending in `.01` -> FAILED
- Amount ending in `.02` -> times out -> UNKNOWN (verifyTransaction later
  resolves it to SUCCESS, simulating a delayed-but-real payment)
- Same `idempotencyKey` submitted twice -> second call returns the first
  call's result without creating a new provider-side transaction (this is
  what proves our webhook/requery dedup logic actually works, not just that
  it looks correct)

See `backend/src/modules/payments/providers/mock-payment.provider.ts`.
