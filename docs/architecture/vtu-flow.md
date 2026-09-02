# VTU (Airtime/Data) Flow

## 1. Provider Abstraction

```ts
interface VTUProvider {
  getBalance(): Promise<ProviderBalance>;
  listDataPlans(network: Network): Promise<DataPlan[]>;
  purchaseAirtime(req: AirtimePurchaseRequest): Promise<VTUProviderResult>;
  purchaseData(req: DataPurchaseRequest): Promise<VTUProviderResult>;
  verifyTransaction(providerReference: string): Promise<VTUProviderResult>;
}
```

Every request into a `VTUProvider` carries an `idempotencyKey` generated from
our internal `Order.id`. Real providers (VTPass and similar) generally
support a client-supplied `request_id` for exactly this purpose; the
abstraction assumes/requires that.

## 2. Order to VTU Fulfillment

```
Order created (status: CREATED)
  -> priced against Catalog (status: PRICED)
  -> wallet debited via Ledger (status: PAID)   [see note below]
  -> VTUProvider.purchaseAirtime/Data() called   (status: FULFILLING)
       -> SUCCESS  -> status: FULFILLED
       -> FAILED   -> status: FULFILLMENT_FAILED -> ledger reversal -> status: REFUNDED
       -> UNKNOWN  -> status: FULFILLMENT_UNKNOWN -> reconciliation loop (requery)
```

**Debit-before-fulfillment vs fulfillment-before-debit** is a real design
choice. LAUPAY debits first (wallet -> PAID) and only then calls the VTU
provider, because:

- It guarantees the customer cannot receive airtime/data without having
  paid, even under concurrent requests (the wallet lock in the debit step is
  what prevents double-spending across simultaneous orders).
- If the provider call then fails or is unknown, we already have a
  well-defined, idempotent reversal path (see `wallet-ledger-model.md §6`)
  rather than needing a second "should we even charge them" decision after
  the fact.

## 3. Handling Provider Timeout/Unknown

Exactly analogous to payments (`payment-flow.md`): a VTU provider timeout
does not mean the recharge failed - the customer may already have received
airtime and we just didn't get the confirmation. The order moves to
`FULFILLMENT_UNKNOWN`, and the same reconciliation job that requeries
payments also requeries pending VTU orders via `verifyTransaction()`.

Only once a provider gives an authoritative FAILED response does the system
reverse the wallet debit. An order must never be silently abandoned in
`FULFILLMENT_UNKNOWN` - reconciliation must eventually resolve it to
FULFILLED or REFUNDED (with alerting if it stays unresolved past a
threshold, for manual admin review).

## 4. Mock Provider Behavior

`MockVTUProvider` mirrors `MockPaymentProvider`'s simulated outcomes
(configurable success/fail/timeout/duplicate-request scenarios) so the full
order lifecycle above - including reversal and reconciliation - is exercised
in integration tests without spending money on a real provider.

## 5. Future Real Providers

`VTPassSandboxProvider` / `VTPassLiveProvider` (or any other) implement the
same `VTUProvider` interface. Swapping providers is a change to a single DI
binding (`VTU_PROVIDER` token in the Vtu module) - no change to `OrdersService`,
`LedgerService`, or any controller.
