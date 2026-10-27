CREATE UNIQUE INDEX "TransactionDispute_refundEntryId_key"
ON "TransactionDispute"("refundEntryId")
WHERE "refundEntryId" IS NOT NULL;
