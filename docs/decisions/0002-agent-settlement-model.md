# ADR 0002: Agent Settlement Model — OPEN, NOT YET DECIDED

**Status**: Open — blocks Phase 2 agent-facing features
**Date**: Phase 1

## Context
See `docs/architecture/pos-agent-model.md §3`. Agents can be settled either
via a **prepaid float** model (agent tops up their wallet in advance; each
sale debits it) or a **commission** model (agent sells against a company/
provider charge; agent wallet is credited commission afterward).

## Decision
**Not yet made.** This is a business decision (cash flow, risk tolerance,
how agents are onboarded/trusted) as much as a technical one, and the
requester (IBRAHIM LAU PROVISION SHOP) should decide it explicitly before
Phase 2 agent features are implemented against it.

## Why this doesn't block Phase 1
The `LedgerEntry`/`WalletAccount` primitives (`docs/architecture/wallet-ledger-model.md`)
are model-agnostic — both settlement approaches are just different
sequences of the same `credit()`/`debit()` calls. Phase 1 (core ledger
engine, auth, mock providers) can be built and fully tested without this
decision. It only needs to be resolved before the agent-specific order flow
in `OrdersService`/`PaymentsService` is finalized.

## Action Required
Product owner to choose float-down or commission-up (or specify a hybrid)
before Phase 2 begins. Record the decision by updating this ADR's Status and
Decision sections.
