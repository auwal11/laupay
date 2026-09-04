# LAUPAY

Digital payments / VTU platform for **IBRAHIM LAU PROVISION SHOP**.

**Start here:** [`docs/decisions/00-project-status.md`](docs/decisions/00-project-status.md)
— the authoritative, honest record of what is built versus what is only
designed so far. Read it before assuming anything works.

## Documentation Map

- [`docs/architecture/overview.md`](docs/architecture/overview.md) — system architecture
- [`docs/architecture/wallet-ledger-model.md`](docs/architecture/wallet-ledger-model.md) — the financial core (read this early)
- [`docs/architecture/database-design.md`](docs/architecture/database-design.md)
- [`docs/architecture/payment-flow.md`](docs/architecture/payment-flow.md)
- [`docs/architecture/vtu-flow.md`](docs/architecture/vtu-flow.md)
- [`docs/architecture/pos-agent-model.md`](docs/architecture/pos-agent-model.md)
- [`docs/security/security-model.md`](docs/security/security-model.md)
- [`docs/decisions/`](docs/decisions/) — ADRs; see `0002` (agent settlement,
  decided) and `0004` (customer-web integration audit — read before wiring
  `apps/customer-web` to the real backend)

## Repository Layout

```
laupay/
  apps/
    mobile/        # Flutter app — not started (Phase 2+)
    admin/          # Admin web dashboard — not started (Phase 3+)
    customer-web/    # Authenticated web app (customer + agent), Vite/React —
                      # see docs/decisions/0004-customer-web-integration-audit.md
  web/                # Marketing landing page (separate stack — React 19/Tailwind 4/wouter)
  backend/          # NestJS API — Phase 1, built and documented here
  packages/shared/    # Shared types/DTOs — not started
  brand/               # Brand asset placeholder structure (see brand/README.md)
  docs/                  # Architecture, API, security, decisions
  .github/workflows/       # CI (backend lint/test/build on push)
```

## Quick Start (Backend)

See [`backend/README.md`](backend/README.md) for full setup instructions.

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate && npx prisma migrate dev --name init && npx prisma db seed
npm run start:dev
```

## Quick Start (Customer/Agent Web App)

Runs entirely on mock data by default — no backend required to try it.

```bash
cd apps/customer-web
npm install
npm run dev
```

**Before setting `VITE_USE_MOCK_API=false`** to point it at the real
backend, read
[`docs/decisions/0004-customer-web-integration-audit.md`](docs/decisions/0004-customer-web-integration-audit.md)
— several endpoints it expects (PIN, device management, security
notifications, a unified risk-decision flow) don't exist on the backend
yet, and a few response shapes (auth, wallet balance) need reconciling
first.

## Development Cost

₦0. All external integrations (payment, VTU) run against mock providers by
default (`PAYMENT_PROVIDER=mock`, `VTU_PROVIDER=mock` in `.env`) — see
`docs/architecture/payment-flow.md §6` and `vtu-flow.md §4`. No live
provider account or API key is required to build, run, or test the system.

## Current Phase

**Phase 1 — Core foundation.** Architecture, database schema, and the
backend's financial core (auth, wallet/ledger engine, orders, payments,
VTU, webhooks, minimal admin) are built and tested. The Flutter app, the
admin web dashboard, real provider integrations, and a scheduled
reconciliation job are not yet started. Full detail in
`docs/decisions/00-project-status.md`.

GitHub access for pushing this repository will be provided separately, per
the original project brief.
