# LAUPAY — Sandbox Financial Testing Report

Scope: genuine end-to-end sandbox testing of payments (Paystack/Monnify) and VTU
(VTpass) with no simulated/fake success, no live credentials, and no real-money
transactions. Backend + web unit/e2e suites and live sandbox provider calls were run.

---

## 1. Code fixes (this task)

| File | Change |
| --- | --- |
| `backend/src/modules/payments/payments.service.ts` | Inject `AppConfigService`; return the real `providerName` and surface the provider `checkoutUrl` from initialize (was hardcoded `'mock'`, no URL). |
| `backend/src/modules/payments/providers/monnify-payment.provider.ts` | Correct sandbox contract: `POST /api/v1/merchant/transactions/init-transaction` with `paymentReference`/`currencyCode`/`customerName`/`paymentDescription`/`contractCode`; store Monnify `transactionReference` as `providerReference`; verify via `GET /api/v2/transactions/{transactionReference}`. Old shape returned HTTP 405. |
| `backend/src/modules/vtu/providers/vtpass-vtu.provider.ts` | (a) `serviceIdFor(network)` maps MTN/AIRTEL/GLO/9MOBILE → `mtn`/`airtel`/`glo`/`etisalat` (was hardcoded `mtn`); data uses `<serviceId>-data`. (b) `/pay` now sends required snake_case `request_id` (camelCase `requestId` was rejected with `011 "request_id ID is empty"`). (c) re-query path `/api/requery` with `request_id` (was `/api/re-query` → 404). (d) `providerReference` = VTpass `request_id`. |
| `backend/src/modules/webhooks/webhooks.controller.ts` | Verify Monnify webhooks (`monnify-signature`, `eventType`/`eventData`) alongside Paystack; match VTpass callbacks by `providerReference` **or** raw `content.transactions.transactionId`. |
| `backend/src/config/app-config.service.ts` + `backend/src/main.ts` | `assertStagingSafety()` refuses production with mock/simulated providers, and refuses non-sandbox URLs / live keys outside production. Invoked on boot. |
| `web/src/app/services/wallet.ts`, `web/src/app/types/wallet.ts`, `web/src/app/pages/customer/WalletPage.tsx` | Redirect to the provider-hosted `checkoutUrl` when funding initializes (URL was previously dropped). |
| `backend/test/*.e2e-spec.ts` | Fixtures updated to current contract (registration `phone`/`termsAccepted`/`termsVersion`; order 4-digit `pin`; wrong PIN 403; VTpass webhook shape; payment webhook `rawBody`). |

New regression tests: `app-config.service.spec.ts`, `vtpass-vtu.provider.spec.ts`
(service-id mapping, `request_id` on `/pay`, `/api/requery`), `monnify-payment.provider.spec.ts`
(endpoint/payload, `/api/v2` verify), extended `webhooks.controller.spec.ts` (Monnify).

## 2. Automated test results

| Suite | Command | Result |
| --- | --- | --- |
| Backend unit | `npx jest --silent` | **32 passed / 6 suites** |
| Backend e2e | `npx jest --config ./test/jest-e2e.json` (mock providers) | **49 passed / 7 suites** |
| Web typecheck | `npm run typecheck` | **clean** |
| Web build | `npm run build` | **success** |
| Backend build | `npx nest build` | **success** |

Local Postgres 18 (port 55432, db `laupay_test`); all migrations applied incl.
`20261019000000_add_transaction_disputes`.

## 3. Live sandbox results (test credentials, no real money)

Ran the **shipped provider classes** against the real sandbox.

### Monnify — WORKS
- Auth `POST /api/v1/auth/login` → `requestSuccessful=true`.
- Initialize → **PENDING**, real `checkoutUrl = https://sandbox.sdk.monnify.com/checkout/MNFY|…`, `providerReference` = `transactionReference`.
- Verify `GET /api/v2/transactions/{ref}` → **PENDING**.

### VTpass — REACHES PROVIDER, SANDBOX RETURNS FAILED
- `/pay` accepted (correct `serviceID` + `request_id`), code `016` → mapped **FAILED** for MTN and GLO.
- `/api/requery` with `request_id` → consistent **FAILED**.
- `/api/balance` → `401 INVALID CREDENTIALS` (sandbox key/permission limitation).

### Paystack — BLOCKED BY ACCOUNT
- `POST /transaction/initialize` → `"No active channel to process transaction. Please contact merchant"` (account-level); `.test` emails rejected. **Cannot complete a Paystack sandbox payment.**

## 4. Requirements assessment

- **Admin-funded test balance:** `POST /admin/credits/test` (idempotency key, ledger entry,
  audit, notification, `mode:'test'`) and optional auto-credit on registration — implemented and tested.
- **Prevent test credits from being withdrawn/transferred as real money:** no withdrawal,
  transfer, or payout feature exists anywhere in the codebase — risk closed by construction.
- **Separated accounting:** all balance changes go through `LedgerService`; test credits flagged.
- **Automated tests + sandbox verification:** see §2–§3.

## 5. Blockers / limitations (honest)

1. Paystack test mode cannot process a payment for this account (no active channel).
2. VTpass sandbox returns `016 FAILED` for airtime and `401` for `/balance` — sandbox account
   not funded / key lacks permission.
3. Full "card → balance credited" end-to-end requires a human in the hosted checkout (browser);
   no browser is available here.
4. A second agent edits the same working tree (now HEAD `d62519d`); commits must stay scoped
   and race-checked.

## 6. Env var names (no values)
`PAYMENT_PROVIDER`, `VTU_PROVIDER`, `FULFILLMENT_MODE`, `MONNIFY_API_KEY`,
`MONNIFY_SECRET_KEY`, `MONNIFY_BASE_URL`, `MONNIFY_CONTRACT_CODE`, `PAYSTACK_SECRET_KEY`,
`VTPASS_API_KEY`, `VTPASS_SECRET_KEY`, `VTPASS_BASE_URL`, `ADMIN_WEB_ORIGIN`, `JWT_ACCESS_SECRET`.

## 7. Next step requiring approval
Deploy the fixes (Railway backend + Vercel web) so the live sandbox flow can be exercised with
a human completing the Monnify checkout. No deploy will run without explicit approval.
