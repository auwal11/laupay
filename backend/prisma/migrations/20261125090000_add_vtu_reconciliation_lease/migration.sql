ALTER TABLE "VtuTransaction"
  ADD COLUMN "reconcileLeaseToken" TEXT,
  ADD COLUMN "reconcileLeaseExpiresAt" TIMESTAMP(3);
