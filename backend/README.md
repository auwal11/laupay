# LAUPAY Backend

NestJS + TypeScript + PostgreSQL (via Prisma). See `../docs/` for full
architecture, database, security, and decision documentation —
**`../docs/decisions/00-project-status.md` is the most important file to
read before touching this code**: it lists exactly what is and isn't
implemented yet.

## Setup

```bash
cd backend
cp .env.example .env
# edit .env — set DATABASE_URL (runtime queries) and DIRECT_URL
# (Prisma migrations) to point at your Postgres instance. On Supabase,
# DATABASE_URL uses the transaction pooler (port 6543) and DIRECT_URL must
# use the session pooler (port 5432) or the direct connection — see
# backend/.env.example for why.

npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed

npm run start:dev
```

The API will be available at `http://localhost:3000/api`.

> If you're picking this up in an environment with restricted internet
> access, note that `npx prisma generate` needs to reach
> `binaries.prisma.sh` to download its query engine. This was not reachable
> from the sandbox this project was originally scaffolded in — see
> `docs/decisions/00-project-status.md` for details. It should work
> normally on a developer machine or in GitHub Actions (see
> `.github/workflows/backend-ci.yml`).

## Running Tests

```bash
npm test              # unit tests (mocked Prisma — fast, no DB needed)
npm run test:e2e      # integration tests against a real Postgres (DATABASE_URL required)
node test/ledger-concurrency-proof.js   # standalone raw-SQL proof of the locking strategy
```

**Start with `LedgerService`** (`src/modules/ledger/`) — it's the financial
core of the whole system, and its test files
(`ledger.service.spec.ts`, `ledger.e2e-spec.ts`) are the most important in
the repository.

## Project Layout

```
backend/
  prisma/
    schema.prisma       # full database schema
    seed.ts              # starter catalog data (networks, data plans)
  src/
    config/               # env-driven config, fails fast on missing vars
    common/                # guards, decorators, exception filter
    prisma/                 # PrismaService (DB connection)
    modules/
      ledger/                # THE core financial primitive — read this first
      wallet/                 # read-only wallet queries
      auth/                    # register/login/refresh, argon2id + JWT
      users/
      catalog/                  # networks / data plans
      orders/                    # order lifecycle, ties ledger + vtu together
      payments/                   # wallet funding, agent cash, mock provider
      vtu/                          # airtime/data fulfillment, mock provider
      webhooks/                      # signature-verified inbound provider events
      admin/                          # minimal admin slice (dashboard stats only so far)
  test/
    jest-e2e.json
    ledger-concurrency-proof.js     # raw-SQL proof test (no Prisma needed)
```

## Switching From Mock to Real Providers

Nothing outside `modules/payments/providers/` or `modules/vtu/providers/`
needs to change. Implement `PaymentProvider` / `VTUProvider` for the real
provider (e.g. `PaystackProvider`, `VTPassProvider`), then change the DI
binding in `payments.module.ts` / `vtu.module.ts`:

```ts
{ provide: PAYMENT_PROVIDER, useClass: PaystackProvider } // was MockPaymentProvider
```

That's the entire migration for business logic — `LedgerService`,
`OrdersService`, and every controller are provider-agnostic by design.
