CREATE TABLE "NotificationPushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expoPushToken" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRegisteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationPushToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationPushDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "pushTokenId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "ticketId" TEXT,
    "ticketedAt" TIMESTAMP(3),
    "receiptDueAt" TIMESTAMP(3),
    "receiptCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationPushDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPushToken_expoPushToken_key" ON "NotificationPushToken"("expoPushToken");
CREATE INDEX "NotificationPushToken_userId_isActive_idx" ON "NotificationPushToken"("userId", "isActive");
CREATE UNIQUE INDEX "NotificationPushDelivery_ticketId_key" ON "NotificationPushDelivery"("ticketId");
CREATE UNIQUE INDEX "NotificationPushDelivery_notificationId_pushTokenId_key" ON "NotificationPushDelivery"("notificationId", "pushTokenId");
CREATE INDEX "NotificationPushDelivery_status_nextAttemptAt_createdAt_idx" ON "NotificationPushDelivery"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "NotificationPushDelivery_status_receiptDueAt_idx" ON "NotificationPushDelivery"("status", "receiptDueAt");

ALTER TABLE "NotificationPushToken"
  ADD CONSTRAINT "NotificationPushToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationPushDelivery"
  ADD CONSTRAINT "NotificationPushDelivery_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "NotificationPushDelivery_pushTokenId_fkey"
  FOREIGN KEY ("pushTokenId") REFERENCES "NotificationPushToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;
