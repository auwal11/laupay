# Project Status — current source of truth

**Last updated:** 26 November 2026
**Branch:** `main`
**Current commit:** `19c02d6`

This document records what is currently implemented in the repository and what remains incomplete. It replaces the earlier initial-build status that described `apps/mobile` as an empty placeholder.

## Implemented repository areas

- Existing NestJS + Prisma backend with auth, users, wallet/ledger, catalog, orders, payments, VTU/provider abstractions, webhooks, withdrawals, notifications, PIN/security, support/disputes, admin routes and reconciliation code as represented by the current source.
- Existing web application, including the authenticated customer dashboard, wallet, purchase, transaction, receipt, notification and withdrawal source-of-truth flows.
- Expo/React Native/TypeScript mobile app in `apps/mobile/` with secure session foundation and backend-connected customer screens:
  - login/register and auth validation foundation;
  - dashboard, wallet, transaction history and recent activity;
  - Add funds and the missing dashboard Withdraw action;
  - airtime/data purchase flow with catalog, review, custom numeric PIN keypad, idempotency, processing and result;
  - transaction detail/receipt with real status, amount, reference, balance before/after and provider fields;
  - notifications inbox with unread/read actions;
  - withdrawal bank selection with backend-only popular ordering, review, custom numeric PIN keypad, processing and backend status polling;
  - shared spinner-plus-text loading states, receipt sharing and Done navigation on transaction results.
- Mobile dashboard/header/tab bar aligned with the current web LAUPAY Glass V4 palette.
- Documentation synchronized through the current implementation milestone.

## Fresh current checks

The latest mobile UI and transaction-flow changes passed:

```text
cd apps/mobile
npm run typecheck   PASS
npm run lint        PASS
cd ../..
git diff --check  PASS
```

These are source checks only. No Android emulator/device test or native APK/AAB build was completed in the current sandbox session. The custom PIN keypad and receipt share actions have not been verified on a physical Android device in this sandbox. The historical `SANDBOX-TEST-REPORT.md` is not a fresh result for this milestone.

## Still incomplete or not proven

- Profile/security/support-dispute parity and the remaining email verification/password reset mobile coverage require completion/review.
- Mobile unit/integration tests are not configured.
- No verified Android APK/AAB exists from this work; Android SDK/Gradle/EAS tooling and signing choices must be provided through an authorized build route.
- No live provider, payout fulfillment or real-money transaction was tested.
- OS push notification delivery, biometric money authorization, secure PIN reset, rewards/referrals and persisted notification preferences are not claimed.
- Electricity/cable-TV purchase APIs, transfers and authoritative rewards/referrals APIs are not available in the audited backend; those services must remain disabled/unavailable.
- The server-side order-risk result is an always-allow placeholder, not a fraud engine.
- `apps/customer-web` remains a separate Vite/React shell whose shipped default is the mock adapter; its real-backend contract gaps remain documented in `docs/decisions/0004-customer-web-integration-audit.md`.

## Integrity rules

Backend remains authoritative for balance, price, eligibility, transaction state, withdrawal review and settlement. Mobile must not fabricate financial data, bypass PIN/ownership controls, convert pending/unknown into success or credit a wallet after a client checkout return. Production settings and real money must not be changed as part of documentation or UI work.
