# Security Model

## 1. Authentication (MVP)

- Email + password registration/login.
- Passwords hashed with `argon2id` (preferred over bcrypt for new systems;
  `backend/src/modules/auth` isolates this behind a `PasswordHasher` service
  so the algorithm can change without touching call sites).
- JWT access tokens, short-lived (15 min default).
- Refresh tokens: opaque random string, stored **hashed** (`RefreshToken.tokenHash`)
  in the database, long-lived, revocable individually (`revokedAt`) and
  rotated on every use (a used refresh token is revoked and a new one issued
  — detects token theft/replay).
- The current auth contract uses email verification; phone OTP is not claimed.
  Backend PIN and refresh-token session operations exist, while biometric
  step-up authorization and hardware device fingerprinting are not claimed
  (see `docs/decisions/00-project-status.md`).

No secret (JWT signing key, DB credentials, provider API keys) is ever
embedded in the Expo/React Native app. The mobile app keeps access credentials
transient where practical and stores refresh credentials through native secure
storage after authentication.

## 2. Authorization

- Role-based (`UserRole`: CUSTOMER, AGENT, ADMIN, SUPPORT), enforced via a
  NestJS `RolesGuard` applied at the controller/route level.
- **Object-level authorization (BOLA/IDOR prevention)**: every endpoint that
  loads a resource by ID (an order, a payment, a wallet) additionally checks
  that the resource belongs to the requesting user (or that the requester is
  ADMIN/SUPPORT), inside the service layer — never relying on "the ID is
  hard to guess" as a control, since IDs are UUIDs but still must not be the
  only barrier.
- Admin endpoints live under a distinct `/admin/*` route prefix, guarded by
  a role check that rejects anything other than ADMIN (SUPPORT gets a
  narrower read-mostly permission set) — enforced by a dedicated
  `AdminGuard`, not by convention alone.

## 3. Input/Output Validation

- All DTOs use `class-validator` decorators; a global `ValidationPipe` with
  `whitelist: true, forbidNonWhitelisted: true` strips/rejects any field not
  explicitly declared — this is what prevents a client from, say, sending a
  `balance` or `status` field on a request body and having it silently
  accepted.
- Response serialization uses explicit response DTOs / `class-transformer`
  `@Exclude()` on sensitive fields (password hashes, internal provider
  references) so internal fields can never leak through an ORM
  `include`/`select` mistake.

## 4. Rate Limiting

- Global rate limiting via `@nestjs/throttler` at the gateway level.
- Stricter, dedicated limits on `/auth/login`, `/auth/register`, and
  `/webhooks/*` to blunt credential-stuffing and webhook-flooding attempts.

## 5. Webhook Signature Verification

Every provider integration implements a `WebhookVerifier` interface
(`verify(rawBody, signatureHeader): boolean`) specific to that provider's
signing scheme. `WebhooksController` rejects any request that fails
verification **before** it reaches business logic — a payload is never
parsed/trusted based on shape alone.

## 6. SQL Injection

Prisma parameterizes all generated queries by construction. Raw SQL
(`$queryRaw`/`$executeRaw`) is avoided by default; the few places it may
become necessary (complex reconciliation reports) must use Prisma's tagged-
template raw query form (which still parameterizes values), never string
concatenation.

## 7. Secure Error Handling

A global exception filter maps internal errors to safe, generic client-facing
messages in production (`NODE_ENV=production`) while logging full detail
(stack trace, request context) server-side only. Stack traces and internal
error messages are never returned in API responses in production.

## 8. CORS & Security Headers

- CORS restricted to known origins (mobile app doesn't need CORS; the admin
  web dashboard's origin is explicitly allow-listed via environment config).
- `helmet` middleware for standard security headers (HSTS, X-Content-Type-Options,
  etc).

## 9. Secrets Management

- All secrets (DB URL, JWT signing key, provider API keys, webhook signing
  secrets) are read from environment variables via a validated config module
  (`backend/src/config`) that fails fast at boot if a required variable is
  missing — never silently falls back to an insecure default in production.
- `.env` is git-ignored; `.env.example` documents every required variable
  with a placeholder, non-secret value.

## 10. Audit Logging

`AuditLog` records: authentication events (including failed logins),
every admin action (with actor, target entity, and metadata), and wallet
adjustments specifically (`WALLET_ADJUSTMENT` action) regardless of which
module triggered them. Audit logs are written in the same transaction as
the action they describe where the action is itself a DB write, so an audit
trail can never silently fail to record a real mutation.

## 11. Threats Explicitly Modeled Against

See the financial integrity checklist in
`docs/decisions/00-project-status.md §4` for the concrete list of attack
scenarios (balance manipulation, double-spend race conditions, webhook
replay, negative balance bypass, IDOR on wallet/order endpoints, privilege
escalation) that must be verified — via both code review and the
corresponding test suites in `backend/test/security.e2e-spec.ts` — before
any claim of production readiness.
