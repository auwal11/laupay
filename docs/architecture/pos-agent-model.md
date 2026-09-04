# POS / Agent Model

## 1. Two Distinct Actors, Never Conflated

| Concept | What it is | Table |
|---|---|---|
| Customer payment | A customer paying (via wallet, card, or transfer) for their own order | `Payment.method IN (WALLET, PROVIDER_CARD, PROVIDER_TRANSFER)` |
| Agent cash collection | An agent receiving physical cash from a walk-in customer, then creating/confirming an order on the customer's behalf | `Payment.method = AGENT_CASH` |
| Agent wallet balance | The agent's own float - what they draw down to fulfil walk-in orders, or what accumulates as commission, depending on the settlement model | `WalletAccount` where `ownerType = AGENT` |
| Company/provider settlement | Money owed between LAUPAY and the upstream VTU/payment provider - not a per-user concept at all | Not yet modeled (see open item below) |

These four are deliberately separate concepts in the schema and must never
be collapsed into a single "transaction" table without a `kind`/`method`
discriminator, which is why `Payment.method` and `WalletAccount.ownerType`
exist as first-class fields rather than being inferred.

## 2. Agent Flow (as currently modeled)

1. Walk-in customer wants ₦500 airtime; agent creates an `Order`
   (`type: AIRTIME`, `agentId: <agent's user id>`).
2. Agent collects ₦500 cash physically.
3. Agent taps "Confirm Cash Received" in the app - creates a `Payment`
   (`method: AGENT_CASH`, `status: PENDING -> SUCCESS` on confirmation).
4. On `Payment.status = SUCCESS`, the same `LedgerService.debit()` primitive
   used everywhere else debits the **agent's own wallet** for the order
   amount (the agent is drawing down their pre-funded float to cover the
   customer's order).
5. `Order` proceeds through the normal VTU fulfillment flow
   (`vtu-flow.md`) exactly as a self-service customer order would.

## 3. Settlement Model: Float (Decided — ADR 0002)

**Decided**: LAUPAY uses the **prepaid float model** (agent tops up their
own wallet in advance; each sale draws it down) — see
`docs/decisions/0002-agent-settlement-model.md` for the full decision
record, confirmed flow, and the pricing-configurability requirement that
comes with it. The commission model (agent credited after the fact) is
explicitly not implemented.

`LedgerEntry`/`WalletAccount` primitives are model-agnostic by
construction, so this decision required no changes to `LedgerService`
itself — only `PaymentsService.confirmAgentCash()`'s specific sequencing of
ledger calls needed to match the float-down flow, which it already does.

## 4. Receipts

Every completed `Order` (regardless of `Payment.method`) can produce a
receipt - a read-only, formatted view of `Order` + its associated `Payment`
+ `VtuTransaction` (network, amount, phone number, reference, timestamp,
status). Receipt generation is presentation-layer only; it introduces no new
financial state and reads exclusively from already-committed records.
