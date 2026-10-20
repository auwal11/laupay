ALTER TABLE "User"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

-- Existing ACTIVE accounts were email-verified during registration; backfill
-- so the admin console shows truthful verification state for historical rows.
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "status" <> 'PENDING_VERIFICATION' AND "emailVerifiedAt" IS NULL;
