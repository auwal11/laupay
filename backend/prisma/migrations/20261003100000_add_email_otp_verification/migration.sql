-- Email OTP verification (requirement 4: Register -> Brevo OTP -> Login).
-- Stores a hashed 6-digit code with a short TTL and an attempt counter so
-- brute-force of the 6-digit space is impossible (max 5 tries / 15 min).
-- The plaintext code is never persisted and never returned by any endpoint.

CREATE TABLE "EmailOtp" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "codeHash"    TEXT NOT NULL,
    "purpose"     TEXT NOT NULL DEFAULT 'REGISTRATION',
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "consumedAt"  TIMESTAMP(3),
    "attempts"    INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailOtp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailOtp_userId_purpose_idx" ON "EmailOtp"("userId", "purpose");
CREATE INDEX "EmailOtp_expiresAt_idx" ON "EmailOtp"("expiresAt");

ALTER TABLE "EmailOtp"
    ADD CONSTRAINT "EmailOtp_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
