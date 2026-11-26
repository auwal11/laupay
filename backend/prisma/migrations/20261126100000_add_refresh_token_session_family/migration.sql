-- Existing refresh tokens become the root of their own session family. New
-- rotated tokens preserve this ID so logout can revoke the whole chain.
ALTER TABLE "RefreshToken" ADD COLUMN "sessionFamilyId" TEXT;
UPDATE "RefreshToken" SET "sessionFamilyId" = "id" WHERE "sessionFamilyId" IS NULL;
ALTER TABLE "RefreshToken" ALTER COLUMN "sessionFamilyId" SET NOT NULL;
CREATE INDEX "RefreshToken_userId_sessionFamilyId_revokedAt_idx"
  ON "RefreshToken"("userId", "sessionFamilyId", "revokedAt");
