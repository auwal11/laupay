# ADR 0002: Agent Settlement Model — DECIDED: Float (Prepaid Wallet) Model

**Status**: Accepted
**Date**: Phase 1 hardening pass

## Context
See `docs/architecture/pos-agent-model.md §3`. Agents could be settled
either via a **prepaid float** model (agent tops up their wallet in
advance; each sale debits it) or a **commission** model (agent sells
against a company/provider charge; agent wallet is credited commission
afterward).

## Decision
**Option A — Float Model.** LAUPAY agents/POS operators operate from a
prepaid wallet/float. Decided by the project owner (IBRAHIM LAU PROVISION
SHOP).

## Confirmed Flow

1. Agent funds their LAUPAY wallet first (via `POST /payments/initialize`
   or, later, a dedicated agent top-up path — same `PaymentsService` either
   way).
2. Agent performs a cash sale for a walk-in customer:
   1. Agent confirms cash received from the customer (`POST
      /payments/confirm-cash`).
   2. Backend validates the authenticated agent and the order
      (`OrdersService`/`PaymentsService` — ownership and existence checks).
   3. Backend **atomically debits the agent's available float** via
      `LedgerService.debit()` — row-locked, negative-balance-checked, exactly
      as every other ledger mutation in the system (see
      `wallet-ledger-model.md`).
   4. The transaction is recorded in the immutable ledger
      (`LedgerEntry`, `reason: AGENT_CASH_COLLECTION`).
   5. The VTU/payment provider transaction is initiated
      (`VtuService.fulfillAirtimeOrder`/`fulfillDataOrder`).
   6. Final provider status is reconciled asynchronously
      (`ReconciliationService`, see `payment-flow.md §3` / `vtu-flow.md §3`).
   7. Agent balance can never go negative — enforced both in application
      code (`LedgerService`) and at the database level (the
      `wallet_balance_non_negative` CHECK constraint — see
      `database-design.md §2`).
   8. All operations are idempotent — enforced via `idempotencyKey` unique
      constraints throughout (`LedgerEntry`, `Payment`, `Order`,
      `VtuTransaction`).

This is exactly what `PaymentsService.confirmAgentCash()` already
implements (see `docs/architecture/pos-agent-model.md §2`) — no change to
that flow was required by this decision; it was built against this model
from the start.

## Pricing: Configurable, Never Hardcoded

**The architecture must support configurable Agent Price and Customer
Price. No example prices are hardcoded in application code.**

- For data bundles, `DataPlan.priceNaira` (what the customer pays) and
  `DataPlan.costNaira` (what the provider charges LAUPAY) are already
  server-side, database-backed catalog fields — `OrdersService.createDataOrder`
  reads `plan.priceNaira` from the database and never accepts a
  client-supplied price (see `docs/security/security-model.md §3`).
- **Not yet modeled**: a distinct *agent* price separate from the customer
  price (i.e., what an agent's float is actually debited, if LAUPAY chooses
  to sell to agents at a discount off the customer-facing price as their
  margin/incentive, rather than 1:1 face value). Today, `confirmAgentCash`
  debits the agent's float for the same `amount` as the order's customer
  price — there is no separate `agentPriceNaira` field yet.
- This is flagged as a concrete, scoped follow-up rather than silently
  assumed: adding an `agentPriceNaira` column to `DataPlan` (and an
  equivalent configurable rate for open-amount airtime, e.g. a per-network
  discount percentage table) is a small, additive schema change that does
  not affect anything built in this hardening pass. It should be done
  as the first task of Phase 2 (agent features), once the exact margin
  structure is specified by the project owner — deliberately not guessed
  at or hardcoded here.

## Why Commission Model Was Not Implemented
Per explicit instruction: the commission model (agent sells against a
provider charge, receives commission after the fact) is not implemented as
the primary or secondary settlement path. All agent-cash code in this
codebase assumes float-down debiting only.
