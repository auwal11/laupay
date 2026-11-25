# LAUPAY Android-first mobile app

Native React Native/Expo Router + TypeScript client in this directory. The app talks to the existing NestJS API; it does not own wallet balances, ledger entries, prices, payment settlement or provider credentials. Backend financial models and migrations are unchanged by this mobile work.

## Local development

Requirements: Node.js compatible with Expo SDK 58, npm 10.9.9, Android Studio/Android SDK for local emulator builds, or Expo Go for supported development preview. On a physical Android device, use the approved Expo development flow and ensure the device can reach the configured HTTPS API.

```bash
cd apps/mobile
npm install
cp .env.example .env.local   # optional; edit only the public API base URL
npm run typecheck
npm run lint
npx expo start
```

The default public API URL is `https://laupay.onrender.com/api`. Set `EXPO_PUBLIC_API_BASE_URL` to a reachable development/staging API when appropriate. This value is bundled into the client and must never contain credentials. No provider API keys, database URLs, signing passwords or private keys belong in mobile environment files. Do not target production for destructive tests or test money flows.

## Current backend mapping

- Authentication: `/auth/register`, `/auth/login`, `/auth/verify-otp`, `/auth/resend-otp`, password reset/change, `/auth/refresh`, `/auth/logout`, `/auth/me`. Verification code is sent by email. Refresh credentials use Expo SecureStore; access tokens stay in memory.
- Wallet/ledger: `/wallet`, `/wallet/transactions`, `/wallet/transactions/:id`. The dashboard and history display backend responses only.
- Funding: `/payments/initialize`, `/payments/virtual-account`. Hosted checkout URLs are opened only over HTTPS. A client checkout return never credits a wallet; trusted server verification/webhooks own settlement.
- Airtime/data: `/catalog/networks`, `/catalog/data-plans/:networkCode`, `/orders/airtime`, `/orders/data`, `/orders`, `/orders/:id`. Prices and final states are server-authoritative; order requests include a backend-verified PIN and idempotency key.
- Profile: `/users/me` GET/PATCH. PIN and session records: `/security/pin/*`, `/security/devices`, `/security/devices/:id/revoke`, `/security/notifications`.
- Notifications: `/notifications`, `/notifications/unread-count`, mark-read/read-all. This is in-app only; there is no claim of OS push delivery.
- Withdrawals: `/withdrawals/banks`, `/withdrawals`, `/withdrawals/:id`. Backend controls eligibility, holds and review; test credits may not be withdrawable and payout is not guaranteed.
- Support: `/support/tickets/me`, `/support/tickets`, `/support/tickets/:id`, `/support/tickets/:id/replies`.
- Disputes: `/disputes` (create/list). The backend enforces transaction ownership and eligibility; opening a dispute is not a refund or ledger mutation.

## Explicitly unavailable

The audited backend has no customer electricity/cable-TV verification/catalog/purchase APIs, no transfers, and no authoritative rewards/referrals API. These are disabled or shown as unavailable; the app does not synthesize balances, provider coverage, transaction history, prices, reward values, bank directories or session hardware identities. Session records are refresh-token sessions, not hardware fingerprinting. Backend order-risk assessment is a placeholder, not fraud protection. Secure PIN reset, biometric step-up authorization, push-token registration and persisted notification preferences are not implemented. The repository also lacks authoritative customer-facing Terms/Privacy document URLs; add and link those documents before store release rather than treating the registration checkbox as a complete legal handoff.

## Android identity/build handoff

Expo config sets display name `LAUPAY`, Android package ID `com.laupay.app`, scheme `laupay`, portrait orientation and generated LAUPAY launcher/adaptive/splash assets. No Android SDK, `adb`, `sdkmanager`, Gradle or EAS CLI was available in the checked sandbox; **no APK/AAB has been built or verified**. Build an APK via the authorized Expo/EAS or Android Studio route once its build toolchain/account and signing choice are available. Never store signing secrets in source control. A successful Expo Web export or TypeScript check is not evidence of a native APK.

## Checks and security notes

Record fresh command output rather than relying on the repository's older `SANDBOX-TEST-REPORT.md`. A dependency audit during this work reported three moderate advisories involving `expo`, `@expo/fingerprint` and `minimatch`; npm's suggested fix downgraded Expo to 52, so no automatic/force fix was applied. Reassess compatible patched versions with Expo SDK 58 before release. Do not test with real money or change backend production data/settings from this app work.
