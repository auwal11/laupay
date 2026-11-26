# LAUPAY backend

NestJS + TypeScript + PostgreSQL via Prisma. This backend is the authoritative source for authentication, wallet balances, ledger entries, catalog pricing, orders, payment settlement, provider status, withdrawals, notifications, PIN/security, support and disputes. The web and mobile clients must not replace these rules with local state or mock financial outcomes.

See [`../docs/decisions/00-project-status.md`](../docs/decisions/00-project-status.md) for the current repository status and [`../docs/architecture/`](../docs/architecture/) for the financial and provider models.

## Setup

```bash
cd backend
cp .env.example .env
# set DATABASE_URL for runtime queries and DIRECT_URL for Prisma migrations
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

The API is available at `http://localhost:3000/api` by default. Keep secrets in local environment configuration only.

## Tests and checks

```bash
npm run lint
npm run build
npm test
npm run test:e2e             # requires an authorized PostgreSQL environment
node test/ledger-concurrency-proof.js
```

Use fresh command output for release evidence; the historical `SANDBOX-TEST-REPORT.md` must not be described as a current run.

## Modules

```text
backend/
  prisma/                 # schema, migrations and seed catalog
  src/modules/
    auth/                 # register/login/refresh/logout and verification contracts
    users/                # profile and role-aware user operations
    ledger/               # atomic credit/debit, locking and idempotency
    wallet/               # authoritative balance/history reads
    catalog/              # networks and data plans
    orders/               # airtime/data order lifecycle
    payments/             # funding and payment state machine
    vtu/                  # airtime/data provider abstraction
    withdrawals/          # bank payout request/review/status lifecycle
    security/             # PIN, sessions and security notifications
    notifications/        # in-app notification records/read state
    support/              # tickets and replies
    disputes/             # transaction dispute ownership/eligibility
    webhooks/             # verified provider events and reconciliation
```

## Provider and release constraints

Provider adapters and mock/sandbox behavior must remain explicit. Provider keys stay on the backend and are never bundled into mobile/web clients. A client checkout return does not settle a wallet; trusted server verification/webhooks do. Withdrawal bank options do not prove that a payout provider is configured. The current order-risk assessment is a placeholder and must not be described as production fraud protection.
