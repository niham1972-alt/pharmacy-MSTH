-- Module 15: Audit Logs — supersede the Module 1 stub. DATA-PRESERVING:
-- audit history must never be wiped, so we RENAME userId -> performedBy rather
-- than drop+add, and relax NOT NULL on branchId/entityId.

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('ROUTINE', 'SENSITIVE', 'CRITICAL');

-- AlterTable (preserve existing rows)
ALTER TABLE "AuditLog" RENAME COLUMN "userId" TO "performedBy";
ALTER TABLE "AuditLog" ALTER COLUMN "branchId" DROP NOT NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "entityId" DROP NOT NULL;
ALTER TABLE "AuditLog" ADD COLUMN "performedByName" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "severity" "AuditSeverity" NOT NULL DEFAULT 'ROUTINE';
ALTER TABLE "AuditLog" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "recordHash" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "previousHash" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_pharmacyId_entityType_entityId_idx" ON "AuditLog"("pharmacyId", "entityType", "entityId");
CREATE INDEX "AuditLog_pharmacyId_performedBy_createdAt_idx" ON "AuditLog"("pharmacyId", "performedBy", "createdAt");
CREATE INDEX "AuditLog_pharmacyId_severity_createdAt_idx" ON "AuditLog"("pharmacyId", "severity", "createdAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateTable
CREATE TABLE "AuditRetentionPolicy" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "detailedRetentionMonths" INTEGER NOT NULL DEFAULT 24,
    "archiveAfterMonths" INTEGER,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditRetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditRetentionPolicy_pharmacyId_key" ON "AuditRetentionPolicy"("pharmacyId");

-- CreateTable
CREATE TABLE "AuditIntegrityCheck" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordsChecked" INTEGER NOT NULL,
    "chainIntact" BOOLEAN NOT NULL,
    "brokenAtRecordId" TEXT,
    "notes" TEXT,

    CONSTRAINT "AuditIntegrityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditIntegrityCheck_pharmacyId_checkedAt_idx" ON "AuditIntegrityCheck"("pharmacyId", "checkedAt");
