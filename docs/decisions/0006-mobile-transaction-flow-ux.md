# Mobile transaction-flow UX

**Status:** Implemented in `apps/mobile/` at commit `19c02d6`  
**Date:** 26 November 2026

## Context

MoneyPoint/OPay-style references were used to evaluate the native LauPay experience. The reusable interaction patterns are useful, but LauPay branding, backend contracts, security controls and server-owned transaction state remain authoritative.

## Decision

Keep Withdraw, Airtime and Data as full-screen, step-based native flows rather than single crowded forms. The flows retain the existing API calls and state polling while using a consistent UX language:

- details or recipient selection;
- amount/plan selection;
- review;
- transaction PIN authorization;
- backend processing/polling;
- backend result with status and receipt actions.

All major asynchronous buttons use the shared `AppButton` loading state: spinner plus action text, disabled while in flight, and existing idempotency protection remains in place.

PIN authorization uses the shared `NumericPinPad` component instead of the system keyboard in Withdraw, Airtime and Data. It accepts exactly four digits, masks progress with dots, supports backspace, and submits the same PIN value to the existing backend endpoint.

Withdrawal banks are still read only from `/withdrawals/banks`. The client only sorts backend-returned records so OPay, Moniepoint, PalmPay and Kuda appear earlier when present; it does not add a static or fake bank directory.

Result screens provide native share-sheet receipt text and a Done action that returns to the dashboard. Backend status, failure reason and pending semantics remain unchanged.

## Branding and platform behavior

The native app preserves LAUPAY navy, gold and light surfaces, with the existing dark-glass dashboard/header treatment. No MoneyPoint or OPay logo, copy or provider behavior is copied. The flow screens remain safe-area aware and use standard React Native touch targets.

## Verification and limitations

`npm run typecheck`, `npm run lint` and `git diff --check` pass at the implementation commit. No Android emulator/device, native APK/AAB, live provider or real-money operation was available in this sandbox. A physical Android verification pass is required before release, especially for keypad layout, share-sheet behavior, keyboard suppression and small-screen safe areas.
