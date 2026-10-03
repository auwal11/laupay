-- NOTE (fixed during staging setup): this migration originally repeated the
-- ALTER/CREATE statements from 20260907192515_add_user_security_and_pricing
-- verbatim, then added the VtuTransaction.orderId unique index. On a fresh
-- database the repeated `ADD COLUMN`/`CREATE TABLE` failed with SQLSTATE 42701
-- ("column agentPriceNaira ... already exists"), so `prisma migrate deploy`
-- could not complete against an empty database — it only worked on databases
-- where migration 3 had not run.
--
-- Every statement is now guarded so this migration is idempotent and applies
-- cleanly to both fresh and already-migrated databases. The genuinely new
-- content is the VtuTransaction_orderId_key index at the end.

-- AlterTable (guarded)
ALTER TABLE "DataPlan" ADD COLUMN IF NOT EXISTS "agentPriceNaira" DECIMAL(18,2);

-- AlterTable (guarded)
ALTER TABLE "Network" ADD COLUMN IF NOT EXISTS "agentDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- CreateTable (guarded)
CREATE TABLE IF NOT EXISTS "UserSecurity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pinHash" TEXT,
    "pinSetAt" TIMESTAMP(3),
    "failedPinAttempts" INTEGER NOT NULL DEFAULT 0,
    "pinLockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSecurity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (guarded)
CREATE UNIQUE INDEX IF NOT EXISTS "UserSecurity_userId_key" ON "UserSecurity"("userId");

-- CreateIndex — the actual purpose of this migration
CREATE UNIQUE INDEX IF NOT EXISTS "VtuTransaction_orderId_key" ON "VtuTransaction"("orderId");

-- AddForeignKey (guarded — Postgres has no ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserSecurity_userId_fkey'
    ) THEN
        ALTER TABLE "UserSecurity"
            ADD CONSTRAINT "UserSecurity_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

