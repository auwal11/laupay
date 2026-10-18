-- LAUPAY: admin console + test credit system
-- Additive only (nullable columns / new tables) so it is safe to apply on a
-- live database. Applied by `prisma migrate deploy` during deploy.

-- Fulfillment mode captured per order
ALTER TABLE "Order" ADD COLUMN "mode" TEXT;

-- Ledger narrative/source/mode/adminId for statements + audit
ALTER TABLE "LedgerEntry" ADD COLUMN "narrative" TEXT;
ALTER TABLE "LedgerEntry" ADD COLUMN "source" TEXT;
ALTER TABLE "LedgerEntry" ADD COLUMN "mode" TEXT;
ALTER TABLE "LedgerEntry" ADD COLUMN "adminId" TEXT;
CREATE INDEX "LedgerEntry_source_idx" ON "LedgerEntry"("source");

-- One-shot auto test credit marker
ALTER TABLE "User" ADD COLUMN "testCreditGrantedAt" TIMESTAMP(3);

-- User-facing notification feed
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'account',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Runtime system settings (non-secret)
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);
