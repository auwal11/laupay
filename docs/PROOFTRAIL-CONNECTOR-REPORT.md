# LauPay ProofTrail Connector Report

## Implemented

The LauPay backend now contains an isolated `ProoftrailModule`. It reuses the existing `DisputesService.create()` path, so authenticated ownership checks, dispute eligibility, duplicate prevention, notifications, and all existing wallet/payment/order/VTU behavior remain unchanged.

Implemented endpoints are `POST /api/prooftrail/disputes`, `GET /api/prooftrail/disputes/:caseId`, and multipart `POST /api/prooftrail/disputes/:caseId/evidence`. The connector builds the ProofTrail transaction contract from an existing LauPay ledger entry and its Order or Payment reference, uses deterministic idempotency for dispute creation, and persists the remote case mapping in `ProoftrailCaseMapping`.

The client implements the authoritative ProofTrail HMAC contract: JSON requests sign `timestamp.exactJsonBody`; status requests sign `timestamp.`; evidence uploads hash `base64(rawMultipartBytes)` with SHA-256 and sign `timestamp.bodyHash`. It sends `X-ProofTrail-Key`, `X-ProofTrail-Timestamp`, `X-ProofTrail-Signature`, and `Idempotency-Key` as required.

`POST /api/prooftrail/webhooks` verifies event ID, timestamp skew (300 seconds), HMAC-SHA256, and constant-time signature equality. Replay is blocked by the unique `ProoftrailWebhookEvent.eventId` record. Valid events update only the ProofTrail mapping and local `TransactionDispute.status`; they never mutate ledger balances, payments, orders, VTU transactions, or transaction status handling.

## Deployment requirements

1. Provision the LauPay partner in ProofTrail and set `PROOFTRAIL_API_KEY`, `PROOFTRAIL_API_SECRET`, and the matching webhook secret in the LauPay server environment. Set `PROOFTRAIL_BASE_URL` to the deployed ProofTrail origin and enable `PROOFTRAIL_ENABLED=true`.
2. Configure the ProofTrail webhook URL as `https://<laupay-api>/api/prooftrail/webhooks`. Allow server-to-server traffic and preserve the exact JSON body bytes through the reverse proxy.
3. Run `prisma migrate deploy` against the production session/direct database connection, then restart the backend. `prisma generate` must run as part of the build.
4. Run an authorized synthetic E2E test using a synthetic LauPay transaction and ProofTrail test/staging partner. Confirm create idempotency, status retrieval, one valid evidence upload, webhook signature verification, replay rejection, and cross-user access denial.
5. Do not use live payment, wallet funding, airtime/data purchase, refund, or chargeback actions as part of connector validation. The connector does not initiate payments or refunds.
6. Configure monitoring for ProofTrail HTTP failures, webhook 401/400 responses, and mapping rows whose `lastSyncedAt` is stale. No production secrets belong in source control, client bundles, logs, or test fixtures.

## Verification status

The implementation is backend-only and database-backed. Full Prisma generation, build, lint, and automated connector tests must be run in the LauPay backend environment after dependency installation and database/test environment availability. Production activation remains intentionally blocked until the deployment requirements above are completed.
