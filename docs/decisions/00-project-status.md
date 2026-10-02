# Project Status — READ THIS FIRST

This document is the single source of truth for what exists in LAUPAY today
versus what is designed-but-not-built. It will be updated at the end of
every work session. Do not assume anything not listed under "Implemented"
actually works.

Last updated: Phase 1, initial build.

## 1. Implemented

- [x] Monorepo structure (`apps/`, `backend/`, `packages/shared/`, `brand/`, `docs/`)
- [x] Architecture documentation (overview, wallet/ledger model, payment
      flow, VTU flow, POS/agent model, database design, security model)
- [x] ADRs for framework choice and the open agent-settlement question
- [x] Complete PostgreSQL schema via Prisma (`backend/prisma/schema.prisma`)
      covering users, wallet/ledger, catalog, orders, payments, VTU, audit
- [x] NestJS backend scaffold — see `backend/` — with:
  - [x] Config module (fails fast on missing required env vars)
  - [x] Prisma module/service (DB connection)
  - [x] `LedgerService` — the core financial primitive: `credit()`/`debit()`
        with row-level locking, idempotency, negative-balance prevention,
        all inside DB transactions
  - [x] `WalletService` — read-side balance/history queries
  - [x] Auth module — register/login, argon2id password hashing, JWT access
        tokens, refresh token rotation
  - [x] Users module — profile CRUD, role-based guard
  - [x] Catalog module — networks/data plans (read endpoints, seed data)
  - [x] `PaymentProvider` interface + `MockPaymentProvider` implementing the
        full PENDING/PROCESSING/SUCCESS/FAILED/UNKNOWN behavior described in
        `payment-flow.md`, including simulated timeouts and idempotent
        duplicate-request handling
  - [x] `VTUProvider` interface + `MockVTUProvider`, same idea, for
        `vtu-flow.md`
  - [x] Orders module — create airtime/data order, price snapshot, delegates
        to Payments/VTU
  - [x] Payments module — wallet funding via mock provider, agent cash
        confirmation endpoint
  - [x] Webhooks module — signature verification abstraction + idempotent
        event recording (`PaymentEvent`) wired to `MockPaymentProvider`'s
        webhook simulation
  - [x] Global `ValidationPipe` (whitelist/forbid-non-whitelisted), `helmet`,
        CORS config, rate limiting via `@nestjs/throttler`
  - [x] Global exception filter (no stack traces leak in production mode)
  - [x] Audit logging on auth events and wallet-affecting admin actions
- [x] Unit + integration tests for the ledger engine specifically (credit,
      debit, insufficient balance, duplicate idempotency key, concurrent
      debit race) — see `backend/test/wallet.e2e-spec.ts`
- [x] `.env.example`, `.gitignore` (secrets never committed)
- [x] Brand asset folder structure (placeholders only — see `brand/README.md`)

## 2. Designed But NOT Yet Implemented

These are architected (the docs describe how they should work) but have
**no corresponding code yet**:

- [ ] Full admin CRUD (user management, order management, audit log
      browsing) — only `GET /admin/dashboard` (stats) and
      `POST /admin/reconciliation/run` (manual trigger) exist
- [ ] `VtuTransactionEvent`-style dedup table for the VTU webhook (it
      currently relies on `requeryTransaction`'s natural idempotency
      instead of an explicit event log like the payment webhook has —
      see `docs/decisions/0003-phase1-hardening-review.md` Remaining Risk #1)
- [ ] Automatic wallet reversal when a VTU transaction resolves to FAILED
      *asynchronously* (via webhook/reconciliation) after already returning
      something other than FAILED on the initial synchronous attempt —
      **CLOSED**, see `docs/decisions/0003-phase1-hardening-review.md`
      Remaining Risk #2 and §2b below.
- [ ] Full bills-payment flow (mentioned in the original brief, not yet
      modeled beyond airtime/data)
- [ ] Per-route rate limiting beyond auth/webhooks/security (orders/payments
      use the global default only)

## 2a. Implemented in the Phase 1 Hardening Pass

Added after the items above were first identified as gaps — see
`docs/decisions/0003-phase1-hardening-review.md` for full detail on each:

- [x] `ReconciliationService` — scheduled job (every minute) requerying
      stale PROCESSING/UNKNOWN payments and VTU transactions, plus a manual
      `POST /admin/reconciliation/run` trigger
- [x] `test/security.e2e-spec.ts` — real-HTTP IDOR/BOLA suite (order
      ownership, role gating, DTO-tampering rejection, unauthenticated
      access rejection)
- [x] `test/payments-webhooks.e2e-spec.ts` — webhook signature verification,
      replay/duplicate-event protection, full state-machine coverage
      (SUCCESS/FAILED/UNKNOWN paths), timeout-is-not-failure regression
      test, reconciliation-resolves-UNKNOWN test, payment-amount-tampering
      test
- [x] `POST /orders/data` — was missing; data purchases now price strictly
      from the server-side `DataPlan` catalog record
- [x] `POST /webhooks/vtu` — was missing (with the dedup caveat noted above)
- [x] ADR 0002 (agent settlement model) — decided: Float Model; recorded
      with the full confirmed flow and a pricing-configurability note

## 2b. Implemented After `apps/customer-web` Integration Audit

Follow-up work closing gaps identified while auditing the second agent's
frontend shell (`docs/decisions/0004-customer-web-integration-audit.md`):

- [x] **Closed Remaining Risk #2** (VTU async-failure reversal) —
      `OrdersService.reconcileVtuTransaction`/`applyVtuOutcome` is now the
      single shared path used by the synchronous fulfillment call, the VTU
      webhook, and the reconciliation job, so an order that resolves to
      FAILED *after* an initial UNKNOWN result now correctly reverses the
      wallet debit. Regression-tested in
      `backend/test/vtu-reconciliation.e2e-spec.ts`.
- [x] Minimum PIN backend (`backend/src/modules/security/`) —
      `GET /security/pin/status`, `POST /security/pin`,
      `POST /security/pin/change`, `POST /security/pin/verify`, with real
      lockout (5 failed attempts → 15 minute lock) and argon2id hashing.
      `POST /security/pin/forgot` intentionally not implemented (needs OTP
      infrastructure that doesn't exist yet). Tested in
      `backend/test/security-pin.e2e-spec.ts`.
- [x] Placeholder risk-decision shape — order creation responses now
      include `riskDecision: "allow"` (always — not a real risk engine, see
      `SecurityService.assessOrderRisk`'s docblock) so the frontend has a
      real shape to render against.
- [x] Agent price vs. customer price configurability (ADR 0002) —
      `Network.agentDiscountPercent` and `DataPlan.agentPriceNaira` added;
      `PaymentsService.computeAgentDebitAmount` resolves the actual agent
      debit from these, falling back to face-value (0% discount) when
      unconfigured. No margin numbers hardcoded anywhere.
- [x] **Security fix**: `POST /payments/confirm-cash` no longer accepts a
      client-supplied `amount` — it was previously trusted directly for a
      wallet debit with no cross-check against the order (a real
      balance-manipulation vulnerability). The amount is now always
      computed server-side. Regression-tested in
      `backend/test/agent-pricing.e2e-spec.ts`, including a test that
      confirms sending `amount` in the request body is now rejected
      outright (400) rather than silently ignored.

## 3. Not Started At All

- [ ] **Flutter mobile app** (`apps/mobile/`) — empty placeholder only
- [ ] **Admin web dashboard** (`apps/admin/`) — empty placeholder only
- [ ] Real provider integrations (Paystack, VTPass) — only mocks exist, by
      design, per the ₦0-development-cost requirement
- [x] CI pipeline content — `.github/workflows/backend-ci.yml` exists
      (lint/unit/e2e/build on push, spins up its own Postgres) and
      automatically picks up every new `*.e2e-spec.ts` file added since
      (jest-e2e.json globs by pattern, not an explicit file list) — no CI
      config change was needed for the new test files in §2b
- [x] Minimum PIN backend — see §2b (device/session management and
      biometric auth remain unbuilt)
- [ ] KYC/BVN/NIN verification
- [ ] Settlement/payout tables at the company-vs-provider level
- [ ] Real risk-decision engine (ALLOW/VERIFY/HOLD/REJECT) — only an
      always-"allow" placeholder exists so far, see §2b and
      `docs/decisions/0004-customer-web-integration-audit.md §3.3`
- [ ] Unified transaction-history endpoint (joining Order+Payment status,
      as opposed to raw ledger entries) — needed by `apps/customer-web`'s
      wallet/transactions UI; see
      `docs/decisions/0004-customer-web-integration-audit.md §3.2`
- [ ] Device management, security notifications — see
      `docs/decisions/0004-customer-web-integration-audit.md §3.3`

## 3a. `apps/customer-web` — Added, Runs on Mock Data Only

A Vite/React/TypeScript authenticated web app (customer + agent) was
contributed as a separate frontend (kept isolated from the `web/` marketing
site due to incompatible major dependency versions — see
`docs/decisions/0004-customer-web-integration-audit.md §1`). It compiles
and builds clean (`npm install && npm run typecheck && npm run build` all
pass) and runs fully against an in-memory mock layer
(`VITE_USE_MOCK_API=true`, the shipped default) with no backend required.

**It is not yet wired to the real backend** — `VITE_USE_MOCK_API=false`
should not be turned on until the gaps in
`docs/decisions/0004-customer-web-integration-audit.md` are addressed,
particularly §3.3 (no risk-engine/PIN/device/notification backend exists
at all yet).

## 4. Financial Integrity Checklist — Current Status

Per the brief's "before declaring complete" requirement, here is the honest
state of each item **today**. None of these should be read as "done" until
independently re-verified — they reflect what the current automated tests
cover, not a completed audit.

| Check | Status |
|---|---|
| No balance manipulation from client | Enforced by DTO whitelisting + `LedgerService` never accepting a client-supplied balance; covered by unit tests |
| No duplicate transaction credit/debit | Enforced by `idempotencyKey` unique constraints at the DB level; **verified with a real concurrency test against live PostgreSQL — 20 concurrent requests sharing one idempotency key resulted in exactly 1 applied debit, 19 correctly rejected as duplicates** (see §4a) |
| No race-condition double spending | Enforced by `SELECT ... FOR UPDATE` row locking in `LedgerService`; **verified against real PostgreSQL — 50 concurrent debit requests of ₦100 each against a ₦1000 balance resulted in exactly 10 successful debits and a final balance of exactly 0, never negative** (see §4a). Tested at moderate concurrency (50 parallel requests) — not load-tested at production scale |
| No negative balance bypass | Enforced by in-transaction check + DB `CHECK` constraint (see caveat in `database-design.md §2`); covered by a unit test and the real-DB concurrency test above |
| No unauthorized wallet access | Object-level ownership check exists on wallet/order read endpoints; **not yet covered by a dedicated IDOR test suite** |
| No webhook replay vulnerability | `PaymentEvent` unique constraint on `(provider, providerEventId)`; covered by one duplicate-webhook code path, not a broader replay/timing suite |
| No provider timeout causing incorrect financial state | UNKNOWN state machine implemented and unit-tested against `MockPaymentProvider`'s simulated timeout; **not yet exercised against the actual reconciliation job, since that job isn't built yet (see §2)** |
| No inconsistent ledger/balance state | Invariant (`balance == SUM(ledger entries)`) is true by construction (same transaction) and was directly confirmed by the concurrency test's final-balance assertions; **no standalone reconciliation script yet verifies this continuously in a running system** |
| All critical financial ops atomic | Yes, by construction — every `LedgerService` method wraps its work in `prisma.$transaction(...)` |

### 4a. Real Concurrency Proof (executed, not just designed)

Unlike the rest of this table, the two claims above marked "verified" were
actually run against a live PostgreSQL 16 instance during this build
session — not just unit-tested against a mock. Because `npx prisma
generate` could not reach `binaries.prisma.sh` from this sandbox (no
internet route to that host — see §6 below), the proof was run as raw SQL
(`backend/test/ledger-concurrency-proof.js`) implementing the *exact* lock/
insert/update sequence that `LedgerService.applyEntry()` uses, rather than
through Prisma Client directly. Output:

```
Test 1: 50 concurrent debits of 100 against a starting balance of 1000
  Succeeded: 10 (expected exactly 10)
  Rejected (insufficient balance): 40 (expected 40)
  Final balance: 0 (expected 0, never negative)
  Ledger entries written: 10
  PASS

Test 2: 20 concurrent debits of 100, all sharing one idempotency key
  Applied: 1 (expected exactly 1)
  Deduped as duplicate: 19 (expected 19)
  Final balance: 900 (expected 900)
  PASS
```

`backend/src/modules/ledger/ledger.e2e-spec.ts` runs the equivalent
scenario through the actual `LedgerService` TypeScript code (not a
reimplementation) — **this has now been run successfully** against a real
PostgreSQL 16 instance (executed by the project owner after generating
Prisma Client and running migrations):

```
PASS  src/modules/ledger/ledger.e2e-spec.ts
  LedgerService (e2e, real Postgres)
    ✓ never allows balance to go negative under 50 concurrent debits against a 1000 balance (134 ms)
    ✓ applies a debit exactly once when the same idempotency key is submitted 20 times concurrently (63 ms)
```

This closes the gap noted in the original version of this section — the
actual application code (not just a raw-SQL stand-in) is now confirmed safe
under real concurrent load.

## 5. Sandbox Limitation: Prisma Client Generation

This build session's working environment could reach `github.com`,
`npmjs.com`, and `pypi.org`, but **not** `binaries.prisma.sh`, which
`npx prisma generate` needs to download its query engine binary. This means:

- `backend/src/**/*.ts` was written against the schema but could not be
  type-checked with a fully generated `@prisma/client` in this session —
  `npx tsc --noEmit` currently reports errors that are 100% attributable to
  the missing generated types (e.g. `Cannot find name 'LedgerReason'`), not
  to logic errors in the code.
- `ledger.e2e-spec.ts` and the full NestJS app could not be run end-to-end
  here.
- The raw-SQL proof test (§4a) was used as a substitute to still get real
  evidence for the highest-risk part of the system (concurrent locking +
  idempotency) without needing Prisma Client at all.

**Action for whoever picks this up next**: run
`cd backend && npm install && npx prisma generate && npx prisma migrate dev`
on a machine or CI runner with normal internet access. This is a completely
standard step for any Prisma project and is expected to work without
modification — `.github/workflows/backend-ci.yml` already does this on
every push. Once generated, re-run `npx tsc --noEmit`, `npm test`, and
`npm run test:e2e` and fix anything that surfaces (expected to be minor —
mostly a sanity pass, since the schema and service code were written
together and cross-checked manually against each other).

## 6. Bottom Line

**This is not production-ready for real money.** It is a solid, tested
foundation for the wallet/ledger/order/payment/VTU core with mock providers.
Before any real-money claim: build the reconciliation job, finish the IDOR/
security test suite, complete the admin module, integrate at least one real
provider in sandbox mode, and run a dedicated financial/security review pass
per the brief's final requirement.

## Update 2026-10-02 — fix-vtu-async-reversal stabilised
- `VtuTransaction.orderId` is now `@unique` (one VtuTransaction per Order; `Order.vtuTransaction` is now a 1:1 relation).
- Added migration `20261002000000_add_security_agent_pricing_and_vtu_orderid_unique`. The branch previously had schema changes for `UserSecurity` (PIN) and agent pricing (`DataPlan.agentPriceNaira`, `Network.agentDiscountPercent`) with **no migration file**; this migration now covers them too.
- `test/agent-pricing.e2e-spec.ts` re-logs in after promoting the user to AGENT (JWT roles are fixed at issuance — test bug, not an app bug).
- Result: unit 6/6, e2e 42/42 (local Postgres 17). One e2e run on a freshly reset DB showed 1 failure that did not reproduce in 4 subsequent runs — treat as a possible flaky test to investigate.
- Not production-ready for real money; still requires a dedicated financial/security review.
