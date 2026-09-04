# ADR 0004 / Integration Audit: `apps/customer-web` vs. the Real Backend

**Status**: Informational — records the audit performed before merging the
second agent's frontend shell, and lists exactly what must be built or
decided before it can be switched off mock data (`VITE_USE_MOCK_API=false`).

## 0. What Was Done

- Inspected the uploaded `laupay-app-shell.zip` in full: file tree,
  `INTEGRATION.md`, every `services/*` adapter, every `types/*` file,
  `tsconfig.json`/`package.json`, `.env.example`.
- Ran `npm install` (145 packages, clean) and `npm run typecheck` —
  found 6 real type errors, all in `PurchaseWizard.tsx` (a `Record<string,
  string>` losing type safety under `noUncheckedIndexedAccess` when only a
  loosely-typed `STEP_LABELS` map backed it). **Fixed** by typing it as
  `Record<PurchaseStep, string>` instead — no behavior change, just gives
  TypeScript the exhaustiveness check it needs. `npm run build` (tsc +
  vite build) now passes clean.
- Compared every assumed endpoint/response-shape in `services/*.ts` and
  `types/*.ts` against the actual NestJS controllers/DTOs/Prisma schema in
  `backend/`.
- **Did not** merge this into the existing `web/` marketing site — see §1.
- **Did not** wire `VITE_USE_MOCK_API=false` or invent any backend
  endpoint/field to make the contracts appear to match — every gap below
  is left as a gap, not silently papered over.

## 1. Why This Is `apps/customer-web/`, Not Merged Into `web/`

`web/` (the existing marketing landing page) and this shell are
**incompatible at the dependency level**, not just different projects:

| | `web/` (landing page) | shell (now `apps/customer-web/`) |
|---|---|---|
| React | 19.0.0 | 18.3.1 |
| Tailwind | 4.x (`@tailwindcss/vite`, CSS-first config) | 3.4.6 (postcss + `tailwind.config.ts`) |
| Router | `wouter` | `react-router-dom` v6 |
| TypeScript | `^7.0.2` | `^5.5.3` |

Forcing these into one `package.json`/build would mean picking one React
major version and one Tailwind major version for both, which is a real
migration project on its own and was never asked for. Keeping them as
separate apps in the monorepo (`web/` = marketing site, `apps/customer-web/`
= authenticated app) is the safe, standard approach — this mirrors the
`apps/mobile` / `apps/admin` split already implied by the original project
structure. No functionality was lost or duplicated by keeping them separate.

## 2. Endpoint-by-Endpoint Contract Comparison

Legend: ✅ matches · ⚠️ path/shape mismatch (fixable in the adapter, no
backend change needed) · ❌ backend endpoint does not exist at all

| Shell expects | Backend actually has | Status |
|---|---|---|
| `POST /auth/register` | `POST /api/auth/register` | ⚠️ missing `/api` prefix + response shape (see §3.1) |
| `POST /auth/login` | `POST /api/auth/login` | ⚠️ same |
| `GET /me` | `GET /api/auth/me` | ⚠️ path differs (`/auth/me`, not `/me`) |
| `POST /auth/forgot-password` | — | ❌ does not exist |
| `GET /wallet/balance` | `GET /api/wallet` | ⚠️ path + shape differ (see §3.2) |
| `GET /wallet/transactions` | `GET /api/wallet/transactions` | ⚠️ path matches; shape is fundamentally different (see §3.2) |
| `GET /wallet/transactions/:id` | — | ❌ no single-transaction lookup endpoint exists |
| `POST /wallet/fund` | `POST /api/payments/initialize` | ⚠️ different module/path/payload shape |
| `GET /networks` | `GET /api/catalog/networks` | ⚠️ path differs |
| `GET /networks/:id/data-plans` | `GET /api/catalog/data-plans/:networkCode` | ⚠️ path differs; param is a network **code** (`"MTN"`), not a UUID `id` |
| `POST /orders` (unified, `kind` field) | `POST /api/orders/airtime`, `POST /api/orders/data` (separate) | ⚠️ needs an adapter-side dispatch by `kind`, or a backend unification |
| `GET /orders/:id` | `GET /api/orders/:id` | ✅ path matches; shape differs (see §3.3) |
| `GET /security/pin/status`, `POST /security/pin`, `POST /security/pin/change`, `POST /security/pin/forgot` | — | ❌ no PIN concept anywhere in the backend |
| `GET /security/devices`, `POST /security/devices/:id/revoke` | — | ❌ no device/session-management model exists |
| `GET /security/notifications`, `POST /security/notifications/:id/read` | — | ❌ no notifications model exists |

## 3. The Three Gaps That Actually Matter (Not Just Path Renames)

Path/prefix mismatches (`/me` vs `/auth/me`, missing `/api` prefix) are
trivial — fix them in `services/*.ts` once `VITE_USE_MOCK_API=false` is
turned on, no backend change needed. The following three are **not**
trivial and need an explicit decision before this frontend can safely go
live against the real backend.

### 3.1 Auth response shape — and a real security finding

The shell's `AuthSession` type expects:
```ts
{ user: AuthUser, tokens: { accessToken, refreshToken? } }
```
The backend's `AuthController.register`/`login` actually return:
```ts
{ accessToken, refreshToken }   // flat, no user object at all
```
Fix direction: either the backend adds the user object to the response
(cheap — one extra query), or the frontend calls `GET /auth/me` right after
receiving tokens to populate `AuthUser`. Either works; needs a decision, not
a guess.

**Security finding**: the shell's `RegisterPayload` includes a client-supplied
`role: Role` field (`"customer" | "agent"`). The backend's `RegisterDto`
has **no `role` field at all** — registration always creates a `CUSTOMER`.
Because the backend's global `ValidationPipe` uses
`forbidNonWhitelisted: true`, **sending `role` in the request body today
would cause the entire registration to be rejected with 400**, not silently
ignored. This is actually the backend behaving correctly and securely
(self-service privilege escalation to `AGENT`/`ADMIN` at registration would
be a real vulnerability) — the fix is on the frontend side: **remove
`role` from the register form/payload entirely**, and treat "becoming an
agent" as a separate, backend-controlled action (e.g. an admin promotes a
user, or a distinct "apply to become an agent" flow with its own approval
step) rather than a self-selected field at signup. Recorded here rather
than silently patched, since it's a product decision (how do agents get
onboarded?) as much as a code fix.

### 3.2 Wallet balance model — single value vs. four buckets

The shell's `WalletBalance` type models four separate figures:
`ngnBalance`, `ngnAvailableBalance`, `ngnPendingBalance`, `ngnHeldBalance`.
The backend's `WalletAccount` has exactly **one** `balance` field — there is
no concept of "pending" or "held" funds anywhere in the ledger model
(`docs/architecture/wallet-ledger-model.md`). A `PENDING` payment simply
hasn't credited yet; it doesn't reserve or "hold" an amount against the
wallet the way the shell's UI (`BalanceCard`) assumes.

This needs a backend design decision, not a frontend workaround: either (a)
the backend stays single-balance and the frontend's pending/held fields are
dropped/simplified until a real hold mechanism exists (e.g. for the
risk-engine `HOLD` decision in §3.3), or (b) a real "held" concept is added
to the ledger (e.g. a `HoldEntry` type that reserves funds without moving
them, released or converted to a `DEBIT` on resolution). **Recommendation**:
defer until the risk-engine/HOLD decision (§3.3) is actually built, since
that's the only thing that would ever populate a non-zero held balance;
until then the frontend can safely treat `ngnAvailableBalance` as
equal to `ngnBalance` and omit pending/held.

Separately: `GET /wallet/transactions` on the backend returns raw
`LedgerEntry` rows (`direction`, `amount`, `balanceAfter`, `reason`,
`createdAt` — **no `status` field**, because a ledger entry only ever
exists after something already succeeded). The shell's `Transaction` type
expects a `status: TransactionState` (the 9-value state machine) on every
row. **These are different concepts**: a "transaction" the user wants to
see in their history is closer to an `Order`/`Payment` (which *do* have a
lifecycle/status) than a `LedgerEntry` (which doesn't, by design — see
`wallet-ledger-model.md §2`). Recommendation: the backend should expose a
purpose-built "transaction history" endpoint that joins/unions
`Order`+`Payment` (with their real status) rather than the frontend
consuming raw ledger entries directly. Not implemented here — flagged as a
required backend addition.

### 3.3 There is no risk engine, PIN, device, or notification backend at all

This is the largest gap, and it's the one the shell's own `INTEGRATION.md`
was most explicit about not building. The entire purchase flow's `verify`
step (`auth_required` status → `riskDecision: "verify"` →
`requiredChallenge: "pin"` → `PinPad`), the `held` status, `RiskDecision`,
`VerificationChallenge`, and every `/security/*` endpoint assume a **risk
engine and PIN/device/notification subsystem that does not exist anywhere
in the current backend**. `OrdersService` today has exactly two outcomes
after a debit succeeds: fulfill, or fail-and-reverse — there is no
allow/verify/hold/reject decision point, no PIN storage/verification, no
device registry, no notification log.

**This must be built on the backend before the purchase wizard's `verify`
step, `SecurityPage`, or any risk-decision UI can be anything other than
mock data.** Recommended minimum backend scope to unblock it (not built in
this pass — listed for planning):
- A `pin_hash` (argon2id, same `PasswordHasher` pattern already used for
  login) on `User` or a dedicated `UserSecurity` table, plus
  `GET/POST /security/pin*` endpoints.
- At minimum a stub risk decision in `OrdersService` — even an "always
  ALLOW" placeholder that returns the right *shape* (`riskDecision: "allow"`)
  would let the frontend's status-rendering code be exercised for real
  before a real risk engine is built.
- Device/notification models are lower priority — the shell already
  degrades reasonably (those pages simply show empty/mocked state) if left
  unbuilt longer.

## 4. What Was Integrated As-Is (No Backend Change Needed)

- The adapter-switch pattern (`services/index.ts`, `VITE_USE_MOCK_API`) —
  sound, no changes.
- `services/api.ts`'s fetch wrapper, in-memory token handling, and 401 →
  session-invalid flow — sound. Minor note: `safeParseError` reads
  `body.code` to distinguish `SESSION_REVOKED`, but the backend's
  `AllExceptionsFilter` response shape is `{ statusCode, message }` with no
  `code` field, so every 401 will currently be treated as "expired" rather
  than ever detecting "revoked" — cosmetic gap, not a blocker (falls back
  to a reasonable generic message either way).
- All UI components (`Button`, `Input`, `Card`, `PinPad`, `BalanceCard`,
  `TransactionList`, `AppNav`, layouts, `ProtectedRoute`) — presentational,
  no backend dependency, nothing to reconcile.
- The 6 TypeScript errors in `PurchaseWizard.tsx` — fixed (§0), unrelated
  to any backend contract question.

## 5. Recommendation

Keep `apps/customer-web` on `VITE_USE_MOCK_API=true` (the shipped default)
until at minimum:
1. Auth response shape is reconciled (§3.1) and the `role` field is removed
   from the register payload (security finding, §3.1).
2. A decision is made on wallet balance modeling and a real transaction-
   history endpoint is added (§3.2).
3. At least a placeholder risk-decision shape exists in `OrdersService`
   (§3.3), even before a real risk engine is built, so the frontend's
   `auth_required`/`verify` path can be exercised against real (if
   simplistic) backend responses instead of only mock data.

None of the above blocks using `apps/customer-web` today as a working,
demonstrable UI against its own mock layer — it only blocks flipping the
one environment variable that points it at the real API.
