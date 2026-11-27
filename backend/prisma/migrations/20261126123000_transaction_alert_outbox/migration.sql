ALTER TABLE "Notification" ADD COLUMN "eventKey" TEXT;
CREATE UNIQUE INDEX "Notification_eventKey_key" ON "Notification"("eventKey");

CREATE TABLE "TransactionAlertOutbox" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "firstAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionAlertOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransactionAlertOutbox_eventKey_key" ON "TransactionAlertOutbox"("eventKey");
CREATE INDEX "TransactionAlertOutbox_status_nextAttemptAt_createdAt_idx" ON "TransactionAlertOutbox"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "TransactionAlertOutbox_userId_createdAt_idx" ON "TransactionAlertOutbox"("userId", "createdAt");

ALTER TABLE "TransactionAlertOutbox"
ADD CONSTRAINT "TransactionAlertOutbox_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
