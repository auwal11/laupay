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
    mobile/        # Native Android-first Expo/React Native + TypeScript app
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

## Quick Start (Android Mobile App)

The native client lives in [`apps/mobile`](apps/mobile/README.md) and connects to the existing NestJS API. It uses the backend for balances, ledger history, catalog pricing, transaction authorization, payment settlement and status; it does not use mock financial data.

```bash
cd apps/mobile
npm install
cp .env.example .env.local  # optional; use a reachable non-production API for tests
npm run typecheck
npm run lint
npx expo start
```

The mobile project supports Expo development. A native Android APK/AAB has not been built or verified in this repository session; see the mobile handoff for the current Android build-tooling requirement and limitations.

## Development Cost

₦0. All external integrations (payment, VTU) run against mock providers by
default (`PAYMENT_PROVIDER=mock`, `VTU_PROVIDER=mock` in `.env`) — see
`docs/architecture/payment-flow.md §6` and `vtu-flow.md §4`. No live
provider account or API key is required to build, run, or test the system.

## Current Phase

**Backend:** existing NestJS/Prisma/PostgreSQL financial core remains the source of truth. **Mobile:** a new Expo/React Native client has been scaffolded and is under implementation; automated checks and a native Android artifact still need verification. Read [`apps/mobile/README.md`](apps/mobile/README.md) and the project-status/decision documents for the current scope; some older repository status documents may predate later backend work.

GitHub access for pushing this repository will be provided separately, per
the original project brief.
