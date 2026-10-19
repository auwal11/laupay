CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED');

CREATE TABLE "TransactionDispute" (
    "id" TEXT NOT NULL,
    "caseReference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TransactionDispute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransactionDispute_caseReference_key" ON "TransactionDispute"("caseReference");
CREATE UNIQUE INDEX "TransactionDispute_userId_ledgerEntryId_key" ON "TransactionDispute"("userId", "ledgerEntryId");
CREATE INDEX "TransactionDispute_userId_createdAt_idx" ON "TransactionDispute"("userId", "createdAt");
CREATE INDEX "TransactionDispute_status_createdAt_idx" ON "TransactionDispute"("status", "createdAt");

ALTER TABLE "TransactionDispute" ADD CONSTRAINT "TransactionDispute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionDispute" ADD CONSTRAINT "TransactionDispute_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
