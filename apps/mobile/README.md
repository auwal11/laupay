# LAUPAY Android-first mobile client

Native Expo Router + React Native + TypeScript client for the existing LAUPAY API. The web application is the source of truth for branding, workflows, copy and business rules. This app does not own wallet balances, ledger entries, final prices, settlement or provider credentials.

## Current implementation

Implemented and connected to backend services:

- Authenticated login/register flow with secure refresh credentials and access-token handling.
- Dashboard with greeting, wallet status/balance, hide/show balance, Add funds, Withdraw, transaction history, quick actions and recent activity.
- Dark LAUPAY Glass dashboard styling aligned with the current web shell: navy background, translucent panels, teal accents, amber balance action and semantic status colors.
- Wallet screen with funding entry points, transactions and withdrawal history.
- Airtime/data purchase flow with live catalog endpoints, phone/amount or plan selection, review, PIN, idempotency key, processing and backend result/status handling.
- Transaction detail/receipt view with reference copy, amount direction, status, balance before/after, service/provider details, share and dispute/report action.
- Notifications inbox with all/unread filters, unread count, mark read and mark all read.
- Withdrawal flow with bank list, backend limits/eligibility, review, PIN, processing and polling for final backend states.

The following are not claimed as complete in the current mobile milestone: profile/security/support-disputes completion, email verification/password reset coverage where routes still need final parity work, push notifications, biometric money authorization, secure PIN reset, rewards/referrals, transfers, electricity/cable services and a verified native Android artifact.

## Local development

Requirements: Node.js compatible with Expo SDK 58, npm, and a reachable API. Android Studio/Android SDK is needed for local native builds; Expo Go or an authorized Expo development route may be used for development preview.

```bash
cd apps/mobile
npm install
cp .env.example .env.local   # optional; set only the public API base URL
npm run typecheck
npm run lint
npx expo start
```

Default API URL: `https://laupay.onrender.com/api`. Never put API keys, provider credentials, database URLs, signing passwords or private keys in mobile environment files.

## Backend contract mapping

- Auth: `/auth/register`, `/auth/login`, `/auth/verify-otp`, `/auth/resend-otp`, password reset/change, `/auth/refresh`, `/auth/logout`, `/auth/me`. The current verification contract sends a six-digit code by email.
- Wallet/ledger: `/wallet`, `/wallet/transactions`, `/wallet/transactions/:id`.
- Funding: `/payments/initialize`, `/payments/virtual-account`; only trusted backend verification/webhooks settle funds.
- Airtime/data: `/catalog/networks`, `/catalog/data-plans/:networkCode`, `/orders/airtime`, `/orders/data`, `/orders`, `/orders/:id`.
- Profile/security: `/users/me`, `/security/pin/*`, `/security/devices`, `/security/devices/:id/revoke`, `/security/notifications` where the existing contract supports the screen.
- Notifications: `/notifications`, `/notifications/unread-count`, read and read-all actions. These are in-app notifications; OS push delivery is not claimed.
- Withdrawals: `/withdrawals/banks`, `/withdrawals`, `/withdrawals/:id`. Backend controls eligibility, holds, admin review and final status.
- Support/disputes: `/support/tickets/*` and `/disputes`; ownership and eligibility remain server-controlled.

## Truthful limitations

The audited backend has no authoritative customer electricity/cable-TV purchase APIs, transfers or rewards/referrals ledger. The app must not fabricate those services or their data. Refresh-token session records are not hardware fingerprints. The backend order-risk result is an always-allow placeholder, not a fraud engine. Returned bank options do not guarantee that live payout fulfillment is configured.

## Android identity and build

Expo configuration uses display name `LAUPAY`, Android package `com.laupay.app`, scheme `laupay`, portrait orientation and the generated LAUPAY assets in `assets/images/`. No APK/AAB has been built or verified in the current sandbox session. A successful TypeScript check or Expo web export is not evidence of a native Android build.

## Current verification

As of commit `8fe8d7e`:

- `npm run typecheck` — passed
- `npm run lint` — passed with no warnings
- `git diff --check` — passed
- No mobile unit/integration suite is configured
- No Android emulator/device, APK/AAB, live provider or real-money test was used
