-- Module 11: Stock Adjustment — the only sanctioned manual stock correction.
-- Additive & data-preserving.

CREATE TYPE "AdjustmentDirection" AS ENUM ('INCREASE', 'DECREASE');
CREATE TYPE "AdjustmentReasonCode" AS ENUM ('PHYSICAL_COUNT_CORRECTION', 'DAMAGED_BREAKAGE', 'THEFT_LOSS_SUSPECTED', 'DATA_ENTRY_CORRECTION', 'EXPIRED_FOUND_OUTSIDE_PROCESS', 'OTHER');
CREATE TYPE "AdjustmentStatus" AS ENUM ('AUTO_APPROVED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

CREATE TABLE "StockAdjustment" (
  "id"                     TEXT NOT NULL,
  "pharmacyId"             TEXT NOT NULL,
  "branchId"               TEXT NOT NULL,
  "adjustmentNumber"       TEXT NOT NULL,
  "medicineId"             TEXT NOT NULL,
  "batchId"                TEXT,
  "direction"              "AdjustmentDirection" NOT NULL,
  "quantity"               INTEGER NOT NULL,
  "unitCostAtRequest"      DECIMAL(12,2) NOT NULL DEFAULT 0,
  "reasonCode"             "AdjustmentReasonCode" NOT NULL,
  "reasonNote"             TEXT,
  "evidenceUrl"            TEXT,
  "linkedReconciliationId" TEXT,
  "status"                 "AdjustmentStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "requestedBy"            TEXT NOT NULL,
  "requestedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedBy"             TEXT,
  "approvedAt"             TIMESTAMP(3),
  "rejectedReason"         TEXT,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StockAdjustment_pharmacyId_adjustmentNumber_key" ON "StockAdjustment"("pharmacyId", "adjustmentNumber");
CREATE INDEX "StockAdjustment_pharmacyId_branchId_medicineId_idx" ON "StockAdjustment"("pharmacyId", "branchId", "medicineId");
CREATE INDEX "StockAdjustment_pharmacyId_status_idx" ON "StockAdjustment"("pharmacyId", "status");
CREATE INDEX "StockAdjustment_reasonCode_idx" ON "StockAdjustment"("reasonCode");
CREATE INDEX "StockAdjustment_linkedReconciliationId_idx" ON "StockAdjustment"("linkedReconciliationId");
