-- Module 18: Settings & System Configuration (additions only)

-- CreateEnum
CREATE TYPE "SettingValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'ENUM', 'JSON');
CREATE TYPE "SettingScope" AS ENUM ('PHARMACY', 'BRANCH');

-- CreateTable
CREATE TABLE "SettingDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "valueType" "SettingValueType" NOT NULL,
    "defaultValue" JSONB NOT NULL,
    "validationRule" JSONB,
    "scope" "SettingScope" NOT NULL DEFAULT 'PHARMACY',
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SettingDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SettingDefinition_key_key" ON "SettingDefinition"("key");
CREATE INDEX "SettingDefinition_category_idx" ON "SettingDefinition"("category");

-- CreateTable
CREATE TABLE "SettingValue" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT,
    "settingKey" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SettingValue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SettingValue_pharmacyId_branchId_settingKey_key" ON "SettingValue"("pharmacyId", "branchId", "settingKey");
CREATE INDEX "SettingValue_pharmacyId_settingKey_idx" ON "SettingValue"("pharmacyId", "settingKey");

-- CreateTable
CREATE TABLE "SettingChangeHistory" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT,
    "settingKey" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SettingChangeHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SettingChangeHistory_pharmacyId_settingKey_changedAt_idx" ON "SettingChangeHistory"("pharmacyId", "settingKey", "changedAt");
