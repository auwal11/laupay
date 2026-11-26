# LAUPAY mobile implementation plan — current state

**Updated:** 26 November 2026. **Repository:** `auwal11/laupay`. **Branch:** `main`. **Current commit:** `8fe8d7e`.

## Objective

Deliver a professional Android-first native LAUPAY experience that faithfully adapts the existing web application. The web app is the source of truth for branding, layout, copy, workflows, API behavior and business rules. The mobile client must reuse backend contracts and must never manufacture financial records or success states.

## Current implementation

`apps/mobile/` is now an Expo Router + React Native + TypeScript client with backend-connected auth, dashboard, wallet, airtime/data purchases, withdrawals, transaction details/receipts and notifications. The latest dashboard work includes the missing Withdraw action and matches the current web dark glass shell.

Completed milestones are in Git history:

- `b0b4386` — dashboard structure aligned with web
- `46c6def` — authentication screens aligned with web
- `1d300f2` — wallet and withdrawal history
- `dcce9c4` — purchases and transaction receipts
- `f139c26` — professional notifications inbox
- `706f33d` — dashboard Withdraw action
- `8fe8d7e` — mobile dashboard colors aligned with web shell

## Source-of-truth contract

The backend owns authentication, token refresh/revocation, wallet balance, ledger, catalog prices, PIN authorization, order/withdrawal state, funding settlement, provider references, reconciliation, ownership checks and dispute eligibility. Mobile uses the existing endpoints and renders server responses. Pending, processing, unknown, failed, refunded and rejected states remain distinct from successful settlement.

## Current visual system

The web and mobile authenticated dashboard use the LAUPAY Glass V4 palette:

- Shell `#0B1220`; raised navy `#111B2D`
- Surface `rgba(255,255,255,.075)`; border `rgba(255,255,255,.14)`
- Text `#F5F7FF`; muted `#B7C0D3`; teal `#58D6B3`
- Amber `#F4B33F`; balance panel uses the blue/teal navy treatment

Receipts and ordinary service forms may retain their own high-contrast surfaces where that is the web source-of-truth. Do not invent a second brand system.

## Next phases

1. Finish profile, security, support/dispute, email verification and password-reset parity where mobile coverage is incomplete.
2. Bring the mobile transaction receipt closer to the web Payment Receipt visual while retaining all real backend fields, including balance before/after and provider data.
3. Add suitable mobile tests and rerun backend tests in an authorized non-production environment.
4. Build and verify an Android artifact through an available Expo/EAS or Android Studio route. No APK/AAB is currently claimed.
5. Review production readiness, provider configuration, legal links, dependency advisories and security evidence before release.

## Non-goals and constraints

Do not add mock balances, fake histories, simulated withdrawals, fake reward points, transfer placeholders, unsupported electricity/cable services or client-side wallet settlement. Do not put provider keys, database credentials or signing secrets in the mobile bundle. Do not run destructive or real-money tests against production.
