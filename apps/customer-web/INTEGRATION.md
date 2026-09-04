# LAUPAY App Shell — Integration Notes

Prepared by the second implementation agent. Frontend-only; nothing here touches
`backend/`, Prisma, or the main repo's landing page.

## 1. What this is

A Vite + React + TypeScript + Tailwind scaffold for the **authenticated**
LAUPAY application (customer + agent), built around the Security
Architecture V1 doc: server-authoritative transaction state machine, risk
decisions (ALLOW/VERIFY/HOLD/REJECT) with PIN step-up, idempotent financial
requests, session expiry/revocation handling, trusted-device and security
notification UX.

It does **not** touch the existing marketing landing page and does not
implement Admin, biometrics, device attestation, or a real risk engine —
see "Deferred" below.

## 2. File tree

```
laupay-app-shell/
├── .env.example
├── package.json / tsconfig.json / vite.config.ts / tailwind.config.ts / postcss.config.js
├── index.html
└── src/
    ├── main.tsx, App.tsx, index.css, vite-env.d.ts
    ├── types/            common, auth, wallet, orders, security
    ├── lib/              cn, format, idempotency
    ├── services/         api (fetch + 401 handler), auth, wallet, orders,
    │                     security, mock (isolated dev fakes), index (adapter switch)
    ├── context/          AuthContext (session lifecycle)
    ├── hooks/            useWallet, useTransactions, usePurchaseFlow, useReducedMotion
    ├── components/
    │   ├── ui/           Button, Input, Card, Badge, EmptyState, ErrorState, Skeleton
    │   ├── nav/          AppNav (role-aware, desktop rail + mobile bar)
    │   ├── wallet/       BalanceCard, TransactionList
    │   ├── purchase/     PurchaseWizard (network→phone→amount/plan→review→
    │   │                 confirm→processing→verify→result)
    │   └── security/     PinPad
    ├── layouts/          AuthLayout, AppShellLayout
    ├── routes/           ProtectedRoute
    └── pages/
        ├── auth/         Login, Register, ForgotPassword
        ├── customer/     Dashboard, Wallet, Airtime, Data, Transactions,
        │                 TransactionDetail, Receipt, Profile, Security
        ├── agent/        AgentDashboard
        └── NotFoundPage
```

## 3. How the pieces fit together

- **Adapter switch** (`services/index.ts`): every component imports
  `{ auth, wallet, orders, security }` from here, never from the individual
  adapter files. `VITE_USE_MOCK_API=false` in `.env` is the one line that
  moves the whole app onto the real backend.
- **Transaction state machine**: `types/security.ts` defines
  `TransactionState` (created/pending/auth_required/processing/success/
  failed/unknown/cancelled/held) — `OrderStatus` and `TransactionStatus`
  are aliases of it. `StatusBadge` renders all nine. The UI never infers
  SUCCESS from an HTTP 2xx; it renders whatever `status` the backend sent.
- **Risk decisions**: `createOrder` returns `riskDecision` +
  `requiredChallenge` on the order. `usePurchaseFlow` routes an
  `auth_required` status to a `verify` wizard step (PIN entry via
  `PinPad`); HOLD comes back as `held`, REJECT as `failed` with
  `riskDecision: "reject"` and a generic message (no internal rule/score
  exposed). ALLOW proceeds straight through.
- **Idempotency**: `lib/idempotency.ts` generates a UUID once per purchase
  attempt (`usePurchaseFlow`) and once per funding attempt (`WalletPage`).
  It's sent as `idempotencyKey` / part of `CreateOrderPayload` and
  `WalletFundingPayload`. This is a de-dup **hint** — the backend must
  still enforce it; the mock adapter demonstrates the contract with an
  in-memory cache keyed on it.
- **Session lifecycle**: `services/api.ts` treats any `401` as
  session-invalid and calls a handler `AuthContext` registers on mount,
  which clears the user and sets `status` to `session_expired` or
  `session_revoked` (distinct from plain `anonymous`). `ProtectedRoute`
  redirects to `/login` for any non-authenticated status and passes the
  reason so `LoginPage` can show a plain-language notice.
- **PIN**: never verified client-side. `PinPad` only collects digits and
  hands the assembled string to the caller; `security.createPin` /
  `changePin` / `verificationCode` on `createOrder` are the only places a
  PIN value travels, straight to the backend.
- **Wallet**: `WalletBalance` distinguishes `ngnBalance` /
  `ngnAvailableBalance` / `ngnPendingBalance` / `ngnHeldBalance`.
  `BalanceCard` surfaces pending/held separately from spendable balance.
  Nothing computes these locally.

## 4. Expected backend endpoints

Assumed paths (confirm with the backend agent before wiring up
`VITE_USE_MOCK_API=false`):

```
POST /auth/register            POST /auth/login
GET  /me                       POST /auth/forgot-password

GET  /wallet/balance           GET  /wallet/transactions
GET  /wallet/transactions/:id  POST /wallet/fund

GET  /networks                 GET  /networks/:id/data-plans
POST /orders                   GET  /orders/:id

GET  /security/pin/status              POST /security/pin
POST /security/pin/change              POST /security/pin/forgot
GET  /security/devices                 POST /security/devices/:id/revoke
GET  /security/notifications           POST /security/notifications/:id/read
```

`POST /orders` accepts `idempotencyKey` and, on a step-up response,
`verificationCode` reusing the same key.

## 5. Environment variables

```
VITE_API_BASE_URL   base URL of the real backend
VITE_USE_MOCK_API    "true" (default) = isolated mock layer, no network calls
                      "false" = real adapters, hits VITE_API_BASE_URL
```

## 6. Assumptions made (flag these to the backend agent)

- Response body shapes for every endpoint above are guesses — field names
  will need reconciling against the real NestJS DTOs.
- Auth uses a bearer access token held in memory (`services/api.ts`); no
  refresh-token rotation or HttpOnly-cookie flow is wired up yet — the
  security doc's preference for secure HttpOnly/SameSite cookies needs a
  real decision from the backend team, since that changes how tokens are
  read/attached entirely.
- PIN "verify" always asks for a 4-digit PIN (`requiredChallenge: "pin"`
  is the only challenge implemented); OTP and device-verification
  challenges are typed (`VerificationChallenge`) but have no UI yet.
- No `admin` role/UI exists — `Role` is `"customer" | "agent"` only.
- No fee-quote endpoint exists yet, so the review step can't show a real
  fee/total before confirming; `Order.fee`/`Order.total` are populated
  only in the response after the order is created.
- Routing assumes the real repo's landing page keeps `/` — this shell
  only adds `/login`, `/register`, `/forgot-password`, and `/app/*`.

## 7. Deferred (per the security doc's own phasing)

**Not built, by design — Phase 2/3 in the source doc:**
velocity/limit UI beyond generic error messages, device-trust scoring,
cooling-off period UI, beneficiary risk, fraud graph, reconciliation
monitoring, admin security workflows, biometric auth, Play Integrity/App
Attest, root/jailbreak detection, certificate pinning.

**Not built — explicitly out of this frontend's scope:**
any fraud scoring logic, any client-side "security" that isn't purely
presentational (all PIN/session/risk decisions are rendered, never
computed, here).

## 8. Known simplifications (a real review should tighten these)

- No dependency install or `tsc`/`vite build` could be run in this
  sandbox (no network access at all — confirmed against both GitHub and
  the npm registry). Every file was hand-written and manually
  cross-checked for type consistency (see notes below), but it has not
  been compiled. Treat first `npm install && npm run typecheck` in a real
  environment as the actual verification step.
- `mock.ts`'s risk-decision distribution, PIN "1234", and dev delays are
  arbitrary — replace entirely once the real backend is live; nothing
  there should influence real thresholds.
