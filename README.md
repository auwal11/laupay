# LAUPAY

Digital payments / VTU platform for **IBRAHIM LAU PROVISION SHOP**.

This repository contains the existing web application, an Expo/React Native mobile client, and the NestJS/Prisma backend. The backend remains the authority for authentication, wallet balances, ledger entries, prices, transaction status, withdrawal eligibility, provider settlement and dispute ownership.

## Current status — 26 November 2026

The mobile client is implemented far enough to exercise the main authenticated customer flows against the existing API. The latest mobile work aligns the native dashboard with the web application's current dark glass visual system and adds the missing dashboard **Withdraw** action.

Completed and backend-connected mobile areas include:

- Login, registration, validation, secure refresh-token storage and authenticated session handling.
- Dashboard greeting, wallet balance/status, hide/show balance, Add funds and Withdraw actions, transaction history entry point, quick services and recent activity.
- Wallet balance, funding entry points, transaction history and withdrawal history.
- Airtime and data purchase flows: network, phone, amount/plan, review, PIN, processing, backend status and result.
- Transaction detail/receipt data from authorized ledger/order endpoints, balance before/after, reference copy, share, dispute/report action and backend status handling.
- Professional in-app notifications inbox with all/unread filters and read/read-all actions.
- Withdrawals through the existing bank-selection, review, PIN, processing and backend status-polling flow; no client-side payout or fake success is used.
- Web customer dashboard and receipt remain the visual and workflow source of truth. Mobile uses the same brand tokens and backend contracts without copying DOM components.

The next implementation areas are profile/security/support-disputes, email verification and password-reset screens where still missing or incomplete, and verified Android build output. No APK/AAB is claimed until an actual native build produces and verifies the artifact.

## Repository layout

```text
laupay/
  web/                 # Existing customer-facing web application/source of truth
  apps/mobile/         # Expo Router + React Native + TypeScript Android-first client
  apps/customer-web/  # Separate Vite customer/agent shell; mock adapter by default
  backend/             # NestJS + Prisma + PostgreSQL API and financial core
  brand/               # Brand source folder; mobile runtime assets live in apps/mobile/assets
  docs/                # Architecture, security, decisions and handoff documentation
  plan.md              # Current implementation plan
  TODO.md              # Current roadmap and acceptance criteria
```

## Mobile development

```bash
cd apps/mobile
npm install
cp .env.example .env.local       # optional; public API URL only
npm run typecheck
npm run lint
npx expo start
```

The default public API base is `https://laupay.onrender.com/api`. Use a reachable development/staging API for testing when appropriate. Never put provider keys, database URLs, signing secrets, passwords or private keys in mobile configuration.

## Backend development

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

See [`backend/README.md`](backend/README.md) for database, test and provider details.

## Web applications

The existing `web/` application is the design and workflow reference for the mobile client. `apps/customer-web/` is a separate authenticated Vite/React shell and runs against its isolated mock adapter by default; read [`apps/customer-web/INTEGRATION.md`](apps/customer-web/INTEGRATION.md) before switching it to a real backend.

## Current visual system

Authenticated customer surfaces use the current LAUPAY Glass palette:

- Shell: `#0B1220`; raised navy: `#111B2D`
- Glass surface: `rgba(255,255,255,.075)`; glass border: `rgba(255,255,255,.14)`
- Text: `#F5F7FF`; muted text: `#B7C0D3`; teal accent: `#58D6B3`
- Primary LAUPAY amber: `#F4B33F`; balance card uses a blue/teal navy treatment

The implementation preserves semantic success, error, pending and processing states. It does not invent balances, transaction records, prices, provider coverage, rewards or settlement outcomes.

## Verification and limitations

Fresh checks on the current mobile source pass:

```text
npm run typecheck  PASS
npm run lint       PASS
git diff --check   PASS
```

The repository does not currently contain a verified Android APK/AAB from this work. Android SDK/Gradle/EAS availability and a signing choice are required for a native artifact. No production payment, destructive migration, provider-setting change or real-money test was performed.

Read [`docs/decisions/00-project-status.md`](docs/decisions/00-project-status.md), [`apps/mobile/README.md`](apps/mobile/README.md), [`apps/mobile/VALIDATION.md`](apps/mobile/VALIDATION.md) and [`TODO.md`](TODO.md) before extending the system.
