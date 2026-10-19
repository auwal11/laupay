ALTER TABLE "EmailOtp" ADD COLUMN "lockedUntil" TIMESTAMP(3);

CREATE TABLE "OtpRateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "lastAttemptAt" TIMESTAMP(3),
    "blockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OtpRateLimit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OtpRateLimit_key_key" ON "OtpRateLimit"("key");
CREATE INDEX "OtpRateLimit_category_windowStartedAt_idx" ON "OtpRateLimit"("category", "windowStartedAt");
