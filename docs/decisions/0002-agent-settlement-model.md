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
- **Implemented**: `Network.agentDiscountPercent` (default `0`) and
  `DataPlan.agentPriceNaira` (nullable) now exist in the schema.
  `PaymentsService.computeAgentDebitAmount` resolves, in order: (1) the
  DataPlan's explicit `agentPriceNaira` if set, (2) the Network's
  `agentDiscountPercent` applied to the order's face value if non-zero, (3)
  otherwise the unchanged default — agent debited at the same face value as
  the customer. No specific discount/margin number is hardcoded anywhere in
  application code; every value comes from the database, and the default
  (0% / not configured) is the deliberate no-op, not a guessed business
  number.
- **Security fix made alongside this**: `confirmAgentCash` previously
  accepted a client-supplied `amount` and debited the agent's wallet for
  exactly that value with no cross-check against the order — a direct
  balance-manipulation vulnerability (a malicious or buggy agent client
  could debit an arbitrary, attacker-chosen amount). Fixed: `amount` was
  removed from `ConfirmCashDto` entirely (the field is now rejected
  outright by DTO whitelisting if present, not silently ignored), and the
  debited amount is always computed server-side via
  `computeAgentDebitAmount`. Regression-tested in
  `backend/test/agent-pricing.e2e-spec.ts`.

## Why Commission Model Was Not Implemented
Per explicit instruction: the commission model (agent sells against a
provider charge, receives commission after the fact) is not implemented as
the primary or secondary settlement path. All agent-cash code in this
codebase assumes float-down debiting only.
