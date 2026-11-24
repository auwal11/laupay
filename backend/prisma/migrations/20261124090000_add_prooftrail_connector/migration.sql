CREATE TABLE "ProoftrailCaseMapping" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "prooftrailCaseId" TEXT NOT NULL,
    "externalTransactionId" TEXT NOT NULL,
    "prooftrailStatus" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "findingsCount" INTEGER NOT NULL DEFAULT 0,
    "reportAvailable" BOOLEAN NOT NULL DEFAULT false,
    "reportSha256" TEXT,
    "reportVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProoftrailCaseMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProoftrailCaseMapping_disputeId_key" ON "ProoftrailCaseMapping"("disputeId");
CREATE UNIQUE INDEX "ProoftrailCaseMapping_prooftrailCaseId_key" ON "ProoftrailCaseMapping"("prooftrailCaseId");
CREATE UNIQUE INDEX "ProoftrailCaseMapping_externalTransactionId_key" ON "ProoftrailCaseMapping"("externalTransactionId");
CREATE INDEX "ProoftrailCaseMapping_prooftrailStatus_updatedAt_idx" ON "ProoftrailCaseMapping"("prooftrailStatus", "updatedAt");
ALTER TABLE "ProoftrailCaseMapping" ADD CONSTRAINT "ProoftrailCaseMapping_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "TransactionDispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProoftrailWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "event" TEXT,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProoftrailWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProoftrailWebhookEvent_eventId_key" ON "ProoftrailWebhookEvent"("eventId");
