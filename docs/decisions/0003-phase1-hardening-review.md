# Phase 1 Hardening Pass — Review Findings

Performed after Phase 1 core functionality was confirmed working end-to-end
against a real PostgreSQL instance (see
`docs/decisions/00-project-status.md §4a`). This document records the
review requested against the original 12-point hardening checklist.

## 1. Reconciliation Jobs — Implemented

`ReconciliationService` (`backend/src/modules/reconciliation/`) runs every
minute via `@nestjs/schedule` (`ScheduleModule.forRoot()`, registered in
`app.module.ts`), finds `Payment` and `VtuTransaction` rows stuck in
`PROCESSING`/`UNKNOWN` for longer than a 2-minute threshold, and requeries
each via the existing idempotent `PaymentsService.requeryPayment()` /
`VtuService.requeryTransaction()` methods. Also exposed as
`POST /admin/reconciliation/run` (ADMIN-only) for on-demand triggering.
Covered by `test/payments-webhooks.e2e-spec.ts` (forces a payment stale,
runs reconciliation, confirms it resolves to SUCCESS and the wallet is
credited exactly once even if reconciliation runs twice).

## 2. IDOR/BOLA Authorization Tests — Implemented

`test/security.e2e-spec.ts` boots the full application over real HTTP
(supertest) and verifies:
- Every protected route rejects unauthenticated requests (401).
- `GET /orders/:id` lets the owner read their own order but returns 403 for
  a different authenticated user, and 404 (not a leak) for a well-formed
  but nonexistent ID.
- Role-gated routes (`POST /payments/confirm-cash` — AGENT only,
  `GET /admin/dashboard`, `POST /admin/reconciliation/run` — ADMIN only)
  reject a CUSTOMER-role token with 403.
- DTO whitelisting actually rejects (400) attempts to smuggle undeclared
  fields (`role` on register, `status` on order creation) rather than
  silently dropping them — this proves `forbidNonWhitelisted: true` is
  correctly wired at the application bootstrap level, not just declared in
  `main.ts` and never actually exercised.

## 3. Wallet Ledger Concurrency/Race Conditions — Confirmed (real DB)

See `docs/decisions/00-project-status.md §4a`. `ledger.e2e-spec.ts` passed
against real PostgreSQL: 50 concurrent debits against a 1000 balance
resulted in exactly 10 successes and a final balance of exactly 0; never
negative.

## 4. Idempotency / Duplicate Requests — Covered

- Ledger level: `ledger.service.spec.ts` + `ledger.e2e-spec.ts` (20
  concurrent requests sharing one idempotency key → exactly 1 applied).
- HTTP level: `security.e2e-spec.ts` confirms `POST /orders/airtime` called
  twice with the same `idempotencyKey` returns the same order and creates
  exactly one `Order` row.
- Webhook level: see §5 below.

## 5. Webhook Signature Validation, Replay, Duplicate Events — Implemented & Tested

`test/payments-webhooks.e2e-spec.ts` verifies:
- A webhook with no signature header is rejected (400).
- A webhook with an incorrect signature is rejected (400).
- A correctly-signed webhook referencing an unknown payment is rejected
  (400) rather than silently accepted.
- The exact same event (`providerEventId`) delivered twice is processed
  once and ignored on replay, backed by the `PaymentEvent` unique
  constraint on `(provider, providerEventId)` — confirmed the event row
  count stays at 1 after a replay.

**Known gap**: the VTU webhook (`POST /webhooks/vtu`, added in this pass)
has no equivalent `VtuTransactionEvent` table — it relies on
`VtuService.requeryTransaction()` being idempotent by construction (only
writes a new status if it actually changed) rather than an explicit event
log. This is weaker than the payment path's belt-and-braces protection.
**Flagged as a remaining risk below**, not silently left undocumented.

## 6. Payment Amount/Reference/Status Tampering — Tested

`test/payments-webhooks.e2e-spec.ts`'s tampering test sends a webhook with
a bogus `amount: 999999` field (not part of the handler's read shape) and
confirms the actual `LedgerEntry` credited reflects the *original* payment
amount, never the injected value — proving there is no code path where a
webhook body's extraneous fields can influence the credited amount.
`security.e2e-spec.ts` additionally confirms order creation rejects a
client-supplied `status` field outright (400) rather than accepting and
ignoring it.

## 7. Transaction State Machine — Verified

`test/payments-webhooks.e2e-spec.ts` exercises all three terminal-ish
outcomes of `PENDING -> PROCESSING -> {SUCCESS | FAILED | UNKNOWN}` using
`MockPaymentProvider`'s deterministic cents-based simulation, and confirms
wallet crediting only ever happens on the SUCCESS path.

## 8. Timeout Handling — Verified

The UNKNOWN-path test explicitly asserts `res.body.status` is `'UNKNOWN'`
and is **not** `'FAILED'` for a simulated provider timeout — this is the
specific regression the whole PENDING/PROCESSING/SUCCESS/FAILED/UNKNOWN
design exists to prevent (see `payment-flow.md §2`), and it is now a named
assertion in the test suite rather than only a documented intention.

## 9. API Coverage — Improved, Not Yet Complete

Added in this pass (were missing against the original brief's API list):
- `POST /orders/data` (was airtime-only before this pass) —
  `OrdersService.createDataOrder`, prices strictly from the server-side
  `DataPlan` catalog record, never from the client.
- `POST /webhooks/vtu` (VTU provider delivery confirmation — see the gap
  noted in §5).

Still not implemented (unchanged from `00-project-status.md §2`): full
admin CRUD (user management, order management, transaction monitoring,
audit log browsing beyond the dashboard-stats endpoint), bills flow,
`POST /payments/confirm-cash`'s pricing does not yet distinguish an agent
price from the customer price (see ADR 0002's pricing section — intentionally
scoped to Phase 2 once margin structure is specified).

## 10. Financial Mutations — Transaction + Row Locking Review

Reviewed every write path that touches `WalletAccount.balance` or
`LedgerEntry`:

| Call site | Goes through `LedgerService`? | Notes |
|---|---|---|
| `AuthService.register` (initial wallet creation) | N/A — creates the wallet row itself, no balance mutation | Wrapped in `prisma.$transaction` alongside the `User` row so a user can never exist without a wallet |
| `PaymentsService.initializeWalletFunding` → `creditWalletForPayment` | Yes (`ledger.credit`) | |
| `PaymentsService.confirmAgentCash` | Yes (`ledger.debit`) | |
| `PaymentsService.requeryPayment` → `creditWalletForPayment` | Yes (`ledger.credit`) | Same idempotent path as the direct-success case — confirmed no separate/duplicate crediting logic exists for the reconciliation path |
| `OrdersService.createAirtimeOrder` / `createDataOrder` | Yes (`ledger.debit`, and `ledger.reverse` on fulfillment failure) | |

**Finding: no call site anywhere in the codebase writes
`WalletAccount.balance` directly.** `LedgerService.applyEntry()` remains the
sole writer, confirming the invariant claimed in
`wallet-ledger-model.md §1`.

## 11. Secrets/Configuration Review

- `AppConfigService` fails fast on missing required vars in production
  (`docs/architecture` — see `config/app-config.service.ts`); no insecure
  default is used for `JWT_ACCESS_SECRET` when `NODE_ENV=production`.
- `.env` is git-ignored; `.env.example` contains only placeholder,
  non-secret values.
- **No Flutter/client code exists yet** (`apps/mobile` is an empty
  placeholder — see `00-project-status.md §3`), so there is currently no
  code path where a provider secret, JWT signing key, or database
  credential could reach client code — this will need to be re-verified
  specifically once `apps/mobile` is built (Phase 2+), as a mobile app
  bundle is a fundamentally different trust boundary than this backend's
  own environment variables.
- Reviewed `MockWebhookVerifier`/`MockPaymentProvider`/`MockVTUProvider`:
  none of them read or embed any real secret — the "shared secret" used for
  mock webhook verification (`'mock-shared-secret'`) is a hardcoded
  development-only stand-in, clearly not a production credential, and is
  never used once `PAYMENT_PROVIDER`/`VTU_PROVIDER` are switched away from
  `mock`.

## 12. Regression Tests for Discovered Issues

Every issue found during this pass has a corresponding test:
- Missing `POST /orders/data` → added, no dedicated regression test beyond
  normal coverage since it's new functionality, not a regression.
- `jest-e2e.json` rootDir bug (`test:e2e` reported "No tests found") →
  fixed in a prior commit (`c3f2b31`); `ledger.e2e-spec.ts` passing is the
  regression guard.
- VTU webhook lacking an event-log-based dedup (see §5/§9) → **not fixed
  in this pass**, documented as a remaining risk below rather than
  silently patched over or left unmentioned.

---

# Remaining Risks (Explicit, Not Silently Assumed Away)

1. **VTU webhook duplicate-delivery protection is weaker than the payment
   webhook's.** No `VtuTransactionEvent` table exists; relies on
   `requeryTransaction`'s natural idempotency. Recommended fix: add a
   `VtuTransactionEvent` table mirroring `PaymentEvent`'s
   `@@unique([provider, providerEventId])` pattern before connecting a real
   VTU provider.
2. ~~**No reversal is triggered if a VTU transaction's status changes to
   FAILED asynchronously...**~~ **CLOSED** (see follow-up pass below,
   `OrdersService.reconcileVtuTransaction` + `applyVtuOutcome`). Both the
   VTU webhook and the reconciliation job now route through the same
   order-aware resolution path used by the original synchronous flow, so a
   transaction that resolves to FAILED after initially returning UNKNOWN
   now correctly reverses the wallet debit and marks the order REFUNDED.
   Regression-tested in `test/vtu-reconciliation.e2e-spec.ts` (stale-order
   reconciliation, webhook delivery, SUCCESS-after-UNKNOWN, and a guard
   test confirming already-terminal orders are never re-touched).
3. **Agent price vs. customer price is not yet a distinct, configurable
   value** (see ADR 0002) — today an agent's float is debited the same
   amount as the customer-facing price. Deliberately scoped out of this
   pass pending the project owner specifying the margin/incentive structure.
4. **Concurrency was tested at moderate scale (50 parallel requests), not
   load-tested at production scale.** The locking strategy is architecturally
   sound (standard Postgres row-lock pattern) but has not been stress-tested
   under, e.g., hundreds of simultaneous requests against a single hot
   wallet.
5. **Full admin CRUD, bills flow, and any real provider integration remain
   unbuilt** — unchanged from `00-project-status.md §3`.
6. **Rate limiting is a single global default plus per-route overrides on
   auth/webhooks only** — orders/payments endpoints don't yet have
   dedicated, tighter limits of their own beyond the global 100/min.
