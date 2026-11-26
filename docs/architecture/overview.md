# LAUPAY — Architecture Overview

Status: **Backend foundation + Expo mobile implementation in progress** (see
`docs/decisions/00-project-status.md` for what is and is not implemented yet).

## 1. What LAUPAY Is

LAUPAY is a Nigerian digital payments / VTU (Virtual Top-Up) platform for
IBRAHIM LAU PROVISION SHOP. It serves two kinds of end users:

1. **Online customers** — pay for airtime/data/bills themselves via wallet or
   card/bank payment.
2. **Agents / POS operators** — collect cash from walk-in customers and create
   transactions on their behalf, settling against their own agent wallet.

The system must be extensible: new financial/digital services (electricity,
cable TV, betting wallet funding, etc.) must be addable later without
rewriting the wallet, ledger, or order engine.

## 2. High-Level Architecture

```
    Expo/React Native Mobile App (customer flows)
Admin Web Dashboard
        |
        v
Backend API (NestJS, TypeScript)
        |
        +-- Auth Module        (registration, login, JWT, roles)
        +-- Users Module       (profiles, roles, KYC status)
        +-- Wallet Module      (balances — READ side only; never mutated directly)
        +-- Ledger Module      (the ONLY place balances are ever changed)
        +-- Catalog Module     (networks, data plans, service pricing)
        +-- Orders Module      (airtime/data/bills purchase requests)
        +-- Payments Module    (funding a wallet: provider-initiated or agent cash)
        +-- VTU Module         (fulfilling airtime/data via provider abstraction)
        +-- Webhooks Module    (inbound provider callbacks, signature-verified)
        +-- Admin Module       (back-office: users, orders, reconciliation, audit)
        |
        v
PostgreSQL (single source of truth)
```

External payment/VTU providers are never called directly by business logic —
every integration goes through a **provider interface** (`PaymentProvider`,
`VTUProvider`). This is what lets us build and test the entire system for
₦0 using `MockPaymentProvider` / `MockVTUProvider`, then swap in
`PaystackProvider` / `VTPassProvider` later by writing a new adapter class —
no change to wallet, ledger, or order logic.

## 3. Core Design Principles

1. **The client is never trusted.** Balance, price, transaction status, and
   authorization are always recomputed/verified server-side. The mobile app
   and web/admin clients only render what the API tells them.
2. **The ledger is the source of truth, not the balance column.** A wallet's
   balance is a *derived/cached* value that must always equal the sum of its
   ledger entries. See `docs/architecture/wallet-ledger-model.md`.
3. **Every financial mutation is atomic and idempotent.** No financial write
   happens outside a database transaction; every financial write carries a
   caller-supplied or system-generated idempotency key.
4. **Providers fail unpredictably — the system must not.** A provider timeout
   is not a failure; it is an `UNKNOWN` state that must be reconciled, not
   silently treated as success or failure. See
   `docs/architecture/payment-flow.md` and `docs/architecture/vtu-flow.md`.
5. **Every module boundary is also a security boundary.** See
   `docs/security/security-model.md`.

## 4. Module Boundaries

| Module | Owns | Never does |
|---|---|---|
| Wallet | Read-side balance queries, wallet account lifecycle | Never mutates balance directly |
| Ledger | The only writer of balance-affecting rows; atomic debit/credit primitives | Never talks to external providers |
| Orders | Order lifecycle (created → priced → paid → fulfilled) | Never talks to providers directly; delegates to Payments/VTU |
| Payments | Wallet funding, agent cash confirmation, provider payment sessions | Never fulfills VTU orders |
| VTU | Airtime/data fulfillment via provider abstraction | Never touches wallet balance directly — always via Ledger |
| Webhooks | Verifying + normalizing inbound provider events | Never trusts payload amounts over what Orders/Payments already expects |
| Admin | Read/operate on all of the above with elevated authorization | Never bypasses the same Ledger primitives regular flows use |

## 5. Repository Layout

```
laupay/
  apps/
    mobile/            # Expo/React Native app (customer flows) — active
    admin/              # Web admin dashboard — Phase 3+
  backend/              # NestJS API — Phase 1 (this phase)
  packages/
    shared/              # Types/DTOs shared between backend and clients
    brand/
    logo/                # Source-package structure — see brand/README.md
  docs/
    architecture/
    api/
    security/
    decisions/
  .github/workflows/     # CI — Phase 1 (lint + test on push)
```

## 6. Related Documents

- `docs/architecture/database-design.md`
- `docs/architecture/wallet-ledger-model.md`
- `docs/architecture/payment-flow.md`
- `docs/architecture/vtu-flow.md`
- `docs/architecture/pos-agent-model.md`
- `docs/security/security-model.md`
- `docs/decisions/00-project-status.md` — **read this first**: what's built, what isn't
- `docs/decisions/0001-*.md` onward — Architecture Decision Records
