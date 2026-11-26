# LAUPAY current roadmap

**Updated:** 26 November 2026. **Current branch:** `main`. **Current commit:** `8fe8d7e`.

This roadmap distinguishes implemented source work from work that still needs completion or independent verification. A passing mobile typecheck/lint is not an Android build, provider certification or production-readiness claim.

## Completed in the current mobile implementation

- [x] Repository, backend contracts, web source-of-truth and existing mobile structure audited.
- [x] Expo Router + React Native + TypeScript mobile client established in `apps/mobile/`.
- [x] Backend-connected login/register/session foundation and auth validation screens.
- [x] Dashboard with greeting, wallet status/balance, hide/show, transaction history, quick actions, recent activity and notification entry point.
- [x] Dashboard Withdraw action routed to the existing backend withdrawal flow.
- [x] Wallet screen with funding actions, transaction history and withdrawal history.
- [x] Airtime/data catalog and purchase flow with review, PIN, idempotency and backend status/result handling.
- [x] Transaction details/receipt data with reference copy, amount direction, status, balance before/after, provider/recipient fields, share and dispute/report action.
- [x] Professional notifications inbox with all/unread filters and read/read-all actions.
- [x] Mobile dashboard/header/tab bar aligned with the current web LAUPAY Glass palette.
- [x] Fresh `npm run typecheck`, `npm run lint` and `git diff --check` passed after the latest UI update.

## Remaining mobile product work

- [ ] Finish and verify profile editing and profile navigation parity with the web app.
- [ ] Finish security center parity: PIN status/change, sessions and backend-supported security notifications; do not claim biometric authorization or secure PIN reset without a contract.
- [ ] Finish support ticket and dispute UX parity, including authorized error/empty states.
- [ ] Finish email verification, resend and password reset screens wherever the current mobile route coverage is incomplete.
- [ ] Review receipt screen against the web Payment Receipt visual source of truth while preserving backend fields such as balance before/after, phone, network and provider reference.
- [ ] Add tests for mobile navigation, validation and rendering of pending/failed/unknown states where a suitable test setup is available.

## Backend/provider-dependent work not to fake

- [ ] Verify funding settlement only through trusted backend/webhook responses.
- [ ] Verify a configured payout provider before describing withdrawals as live; bank options alone do not guarantee payout fulfillment.
- [ ] Keep electricity, cable-TV, transfers and rewards/referrals disabled until authoritative APIs and provider support exist.
- [ ] Replace or properly scope the always-allow order-risk placeholder before making fraud-protection claims.
- [ ] Keep the `apps/customer-web` real-backend adapter off until its documented contract gaps are resolved; its shipped default remains mock data.

## Android build and release verification

- [ ] Build a development APK through authorized Expo/EAS or Android Studio tooling.
- [ ] Inspect package metadata, installability, API configuration and runtime navigation on an Android device/emulator.
- [ ] Produce a signed release artifact only when signing credentials and release configuration are intentionally provided.
- [ ] Never claim an APK/AAB path until the file is actually produced and verified.

## Documentation and release review

- [x] Root, mobile, backend status/plan and validation documentation synchronized with the current source state.
- [ ] Re-run backend unit/e2e suites in an authorized environment and record fresh output separately from historical reports.
- [ ] Review Expo dependency advisories and compatible SDK-58 patch versions before release.
- [ ] Add authoritative customer-facing Terms/Privacy links before store release if they are required by the product flow.
