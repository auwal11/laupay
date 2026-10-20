-- Admin control panel: new roles/statuses, audit evidence columns, disputes
-- messaging, risk events, internal notes and permission grants.
-- Additive only; safe for existing rows (all new columns nullable or defaulted).

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'FINANCE';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'VIEWER';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'FROZEN';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'CLOSED';

ALTER TABLE "User"
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "lastLoginIp" TEXT,
  ADD COLUMN "frozenReason" TEXT,
  ADD COLUMN "twoFactorSecret" TEXT,
  ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AuditLog"
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "before" JSONB,
  ADD COLUMN "after" JSONB,
  ADD COLUMN "userAgent" TEXT;

ALTER TABLE "Order"
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "settledBy" TEXT,
  ADD COLUMN "settledAt" TIMESTAMP(3);

ALTER TABLE "TransactionDispute"
  ADD COLUMN "assignedAdminId" TEXT,
  ADD COLUMN "resolutionNote" TEXT,
  ADD COLUMN "refundEntryId" TEXT,
  ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "AdminNote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "adminId" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisputeMessage" (
  "id" TEXT NOT NULL,
  "disputeId" TEXT NOT NULL,
  "authorType" TEXT NOT NULL,
  "authorId" TEXT,
  "body" TEXT NOT NULL,
  "internal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DisputeMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'info',
  "decision" TEXT,
  "amount" DECIMAL(18,2),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RiskEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminPermissionGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "grantedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminPermissionGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminNote_userId_createdAt_idx" ON "AdminNote"("userId", "createdAt");
CREATE INDEX "DisputeMessage_disputeId_createdAt_idx" ON "DisputeMessage"("disputeId", "createdAt");
CREATE INDEX "RiskEvent_userId_createdAt_idx" ON "RiskEvent"("userId", "createdAt");
CREATE INDEX "RiskEvent_type_createdAt_idx" ON "RiskEvent"("type", "createdAt");
CREATE INDEX "RiskEvent_severity_createdAt_idx" ON "RiskEvent"("severity", "createdAt");
CREATE UNIQUE INDEX "AdminPermissionGrant_userId_permission_key" ON "AdminPermissionGrant"("userId", "permission");
CREATE INDEX "AdminPermissionGrant_userId_idx" ON "AdminPermissionGrant"("userId");

ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisputeMessage" ADD CONSTRAINT "DisputeMessage_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "TransactionDispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskEvent" ADD CONSTRAINT "RiskEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdminPermissionGrant" ADD CONSTRAINT "AdminPermissionGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminPermissionGrant" ADD CONSTRAINT "AdminPermissionGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
