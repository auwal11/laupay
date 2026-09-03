# Database Design

Full schema: `backend/prisma/schema.prisma`. This document explains the
reasoning; the schema is the source of truth for actual fields/types.

## 1. Core Entity Groups

1. **Identity**: `User`, `AgentProfile`, `RefreshToken`
2. **Money (the critical core)**: `WalletAccount`, `LedgerEntry`
3. **Catalog**: `Network`, `DataPlan`
4. **Commerce**: `Order`
5. **Funding**: `Payment`, `PaymentEvent`
6. **Fulfillment**: `VtuTransaction`
7. **Audit**: `AuditLog`

## 2. Key Design Choices

### UUIDs everywhere
All primary keys are UUIDs (`@default(uuid())`), not auto-increment
integers, so that IDs are safe to expose in APIs without leaking sequence
information (a minor but real BOLA/enumeration-hardening measure) and so
that IDs can be generated client-side for idempotency keys where useful.

### `Decimal(18,2)` for all money fields
Never `Float`/`Double` for money — floating point rounding errors are
unacceptable in a ledger. `Decimal` maps to Postgres `NUMERIC`, which is
exact.

### Ledger is append-only
`LedgerEntry` has no update/soft-delete path in the application layer at
all — not even an admin one. Corrections happen via new, opposite-direction
entries (see `wallet-ledger-model.md §6`), so the table is a permanent,
tamper-evident audit trail by construction.

### `idempotencyKey` unique constraints
Present on `LedgerEntry`, `Order`, `Payment`, and `VtuTransaction`. These are
the actual enforcement mechanism for "duplicate request protection" — even
if application-layer deduplication had a bug, the database will still reject
a second insert with the same key.

### `PaymentEvent.@@unique([provider, providerEventId])`
This is the webhook replay/duplicate-delivery defense described in
`payment-flow.md §4` — enforced at the database level, not just in code.

### `WalletAccount.version`
An optimistic-locking counter. Combined with the row-level `SELECT ... FOR
UPDATE` lock taken during any ledger write (pessimistic locking for the
actual mutation), `version` gives cheap detection of any code path that
mistakenly tries to update a wallet snapshot read outside a transaction.

### Snapshotting price/amount on `Order` and `DataPlan.priceNaira`
An order stores the amount actually charged, not a live reference to
current catalog pricing — so a later price change never retroactively
changes what a historical order is considered to have cost.

### `@@check` constraints — corrected approach
An earlier draft of this schema assumed Prisma supported a declarative
`@@check(...)` attribute. **It does not — there is no such attribute in the
Prisma schema DSL, in any version.** Attempting to use it produces a
schema validation error (`P1012: This line is not a valid field or
attribute definition`).

`WalletAccount.balance >= 0` and `LedgerEntry.amount > 0` are instead
enforced as real PostgreSQL `CHECK` constraints added via a **raw-SQL
migration**, generated with:

```bash
npx prisma migrate dev --create-only --name add_financial_check_constraints
```

and hand-written into the resulting empty `migration.sql` file:

```sql
ALTER TABLE "WalletAccount"
  ADD CONSTRAINT "wallet_balance_non_negative" CHECK ("balance" >= 0);

ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "ledger_amount_positive" CHECK ("amount" > 0);
```

then applied with `npx prisma migrate dev`. See
`backend/prisma/migrations/<timestamp>_add_financial_check_constraints/migration.sql`
for the actual file. This is the correct, supported way to express a
constraint PostgreSQL can enforce that Prisma's schema DSL itself cannot
declare — the constraint lives in the database, not just in application
code, so it remains the last line of defense described in
`wallet-ledger-model.md §5` regardless of what Prisma's schema file can
express.

## 3. Indexing Strategy

Indexes are placed to support the two access patterns that matter most for
a financial app: **"show me this user's history"** (`userId`/`walletAccountId`
+ `createdAt`/`status` composite indexes) and **"find stuck transactions for
reconciliation"** (`status` + `updatedAt` composite indexes on `Payment` and
`VtuTransaction`, scanned periodically by the reconciliation job described in
`payment-flow.md §3`).

## 4. What's Deliberately Not in the Schema Yet

- KYC document storage (BVN/NIN verification) — out of scope for the MVP
  auth described in `docs/security/security-model.md §2`.
- Multi-currency support beyond a `currency` string field — no FX/conversion
  logic exists yet.
- Settlement/payout tables for provider reconciliation at the
  company-vs-provider level (as opposed to user-vs-platform) — noted as an
  open item in `docs/decisions/00-project-status.md`.
