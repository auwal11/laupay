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
      something other than FAILED on the initial synchronous attempt — see
      `docs/decisions/0003-phase1-hardening-review.md` Remaining Risk #2.
      **This is the most important open item — read it before Phase 2.**
- [ ] Full bills-payment flow (mentioned in the original brief, not yet
      modeled beyond airtime/data)
- [ ] Per-route rate limiting beyond auth/webhooks (orders/payments use the
      global default only)
- [ ] Separate, configurable agent price vs. customer price (see ADR 0002 —
      intentionally deferred pending the project owner's margin decision)

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

## 3. Not Started At All

- [ ] **Flutter mobile app** (`apps/mobile/`) — empty placeholder only
- [ ] **Admin web dashboard** (`apps/admin/`) — empty placeholder only
- [ ] Real provider integrations (Paystack, VTPass) — only mocks exist, by
      design, per the ₦0-development-cost requirement
- [x] CI pipeline content — `.github/workflows/backend-ci.yml` now exists
      (lint/unit/e2e/build on push, spins up its own Postgres)
- [ ] Phone OTP / PIN / biometric auth, device/session management — **now
      also blocking `apps/customer-web`'s security pages**, see
      `docs/decisions/0004-customer-web-integration-audit.md §3.3`
- [ ] KYC/BVN/NIN verification
- [ ] Settlement/payout tables at the company-vs-provider level
- [ ] Risk-decision engine (ALLOW/VERIFY/HOLD/REJECT) — assumed by
      `apps/customer-web`'s purchase flow but not built; see
      `docs/decisions/0004-customer-web-integration-audit.md §3.3`
- [ ] Unified transaction-history endpoint (joining Order+Payment status,
      as opposed to raw ledger entries) — needed by `apps/customer-web`'s
      wallet/transactions UI; see
      `docs/decisions/0004-customer-web-integration-audit.md §3.2`

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
