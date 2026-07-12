-- Platform / Super-Admin layer: the multi-tenant management plane above Modules 1–18.
-- Additive & data-preserving. Existing tenant data (all rows carry pharmacyId) is
-- backfilled with a Pharmacy row at the end so the current pharmacy is manageable.

CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "BillingStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED');
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT', 'BILLING_OPS');

CREATE TABLE "SubscriptionPlan" (
  "id"                     TEXT NOT NULL,
  "name"                   TEXT NOT NULL,
  "priceAmount"            DECIMAL(10,2) NOT NULL,
  "billingInterval"        TEXT NOT NULL,
  "maxUsers"               INTEGER,
  "maxBranches"            INTEGER,
  "maxMonthlyTransactions" INTEGER,
  "includedFeatures"       JSONB,
  "isActive"               BOOLEAN NOT NULL DEFAULT true,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");

CREATE TABLE "Pharmacy" (
  "id"                 TEXT NOT NULL,
  "businessName"       TEXT NOT NULL,
  "contactEmail"       TEXT NOT NULL,
  "contactPhone"       TEXT,
  "status"             "TenantStatus" NOT NULL DEFAULT 'TRIAL',
  "subscriptionPlanId" TEXT,
  "trialStartedAt"     TIMESTAMP(3),
  "trialEndsAt"        TIMESTAMP(3),
  "billingStatus"      "BillingStatus" NOT NULL DEFAULT 'TRIAL',
  "nextRenewalDate"    TIMESTAMP(3),
  "suspendedAt"        TIMESTAMP(3),
  "suspendedReason"    TEXT,
  "archivedAt"         TIMESTAMP(3),
  "archivedReason"     TEXT,
  "notes"              TEXT,
  "createdBy"          TEXT NOT NULL,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Pharmacy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Pharmacy_status_idx" ON "Pharmacy"("status");
CREATE INDEX "Pharmacy_billingStatus_idx" ON "Pharmacy"("billingStatus");
ALTER TABLE "Pharmacy" ADD CONSTRAINT "Pharmacy_subscriptionPlanId_fkey"
  FOREIGN KEY ("subscriptionPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PlatformStaffUser" (
  "id"         TEXT NOT NULL,
  "authUserId" TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "email"      TEXT NOT NULL,
  "role"       "PlatformRole" NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdBy"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformStaffUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformStaffUser_authUserId_key" ON "PlatformStaffUser"("authUserId");
CREATE UNIQUE INDEX "PlatformStaffUser_email_key" ON "PlatformStaffUser"("email");
CREATE INDEX "PlatformStaffUser_role_idx" ON "PlatformStaffUser"("role");

CREATE TABLE "ImpersonationSession" (
  "id"                  TEXT NOT NULL,
  "platformStaffUserId" TEXT NOT NULL,
  "platformStaffEmail"  TEXT NOT NULL,
  "targetPharmacyId"    TEXT NOT NULL,
  "targetUserId"        TEXT NOT NULL,
  "targetUserEmail"     TEXT,
  "reason"              TEXT NOT NULL,
  "startedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt"             TIMESTAMP(3),
  "endedReason"         TEXT,
  "expiresAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImpersonationSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ImpersonationSession_platformStaffUserId_idx" ON "ImpersonationSession"("platformStaffUserId");
CREATE INDEX "ImpersonationSession_targetPharmacyId_idx" ON "ImpersonationSession"("targetPharmacyId");

CREATE TABLE "PlatformAnnouncement" (
  "id"        TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "message"   TEXT NOT NULL,
  "severity"  TEXT NOT NULL DEFAULT 'INFO',
  "startsAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt"    TIMESTAMP(3),
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeatureFlag" (
  "id"                    TEXT NOT NULL,
  "key"                   TEXT NOT NULL,
  "description"           TEXT,
  "isGloballyEnabled"     BOOLEAN NOT NULL DEFAULT false,
  "enabledForPharmacyIds" TEXT[],
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

CREATE TABLE "PlatformAuditLog" (
  "id"                  TEXT NOT NULL,
  "platformStaffUserId" TEXT NOT NULL,
  "platformStaffEmail"  TEXT NOT NULL,
  "action"              TEXT NOT NULL,
  "entityType"          TEXT NOT NULL,
  "entityId"            TEXT,
  "targetPharmacyId"    TEXT,
  "metadata"            JSONB,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformAuditLog_platformStaffUserId_idx" ON "PlatformAuditLog"("platformStaffUserId");
CREATE INDEX "PlatformAuditLog_action_idx" ON "PlatformAuditLog"("action");
CREATE INDEX "PlatformAuditLog_targetPharmacyId_idx" ON "PlatformAuditLog"("targetPharmacyId");

-- Backfill: register the existing seeded pharmacy as an ACTIVE tenant so the
-- platform layer can manage it immediately (idempotent).
INSERT INTO "Pharmacy" ("id", "businessName", "contactEmail", "status", "billingStatus", "createdBy", "createdAt", "updatedAt")
VALUES ('9742c5a7-0977-4a8d-8438-d72e23a24c75', 'MSTH Pharmacy (seed tenant)', 'admin@pharmacymsth.com', 'ACTIVE', 'ACTIVE', 'system-backfill', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
