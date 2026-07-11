-- Module 9: Purchase Returns — additive only (no changes to Modules 1–8/10 tables).

CREATE TYPE "PurchaseReturnSettlementStatus" AS ENUM ('PENDING', 'CREDITED', 'PARTIALLY_CREDITED', 'REJECTED');
CREATE TYPE "PurchaseReturnReasonCode" AS ENUM ('NEAR_EXPIRY', 'DAMAGED_DEFECTIVE', 'WRONG_ITEM_SHIPPED', 'QUALITY_RECALL', 'EXCESS_STOCK', 'OTHER');

CREATE TABLE "PurchaseReturn" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "originalGrnId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "initiatedBy" TEXT NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settlementStatus" "PurchaseReturnSettlementStatus" NOT NULL DEFAULT 'PENDING',
    "expectedCreditAmount" DECIMAL(14,2) NOT NULL,
    "actualCreditedAmount" DECIMAL(14,2),
    "supplierCreditNoteRef" TEXT,
    "settledAt" TIMESTAMP(3),
    "settledBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseReturn_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PurchaseReturn_pharmacyId_returnNumber_key" ON "PurchaseReturn"("pharmacyId", "returnNumber");
CREATE INDEX "PurchaseReturn_pharmacyId_branchId_returnDate_idx" ON "PurchaseReturn"("pharmacyId", "branchId", "returnDate");
CREATE INDEX "PurchaseReturn_originalGrnId_idx" ON "PurchaseReturn"("originalGrnId");
CREATE INDEX "PurchaseReturn_supplierId_settlementStatus_idx" ON "PurchaseReturn"("supplierId", "settlementStatus");

CREATE TABLE "PurchaseReturnItem" (
    "id" TEXT NOT NULL,
    "purchaseReturnId" TEXT NOT NULL,
    "originalGrnItemId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "batchId" TEXT,
    "quantityReturned" INTEGER NOT NULL,
    "unitCostAtReceipt" DECIMAL(12,2) NOT NULL,
    "reasonCode" "PurchaseReturnReasonCode" NOT NULL,
    "reasonNote" TEXT,
    "relatedRecallId" TEXT,
    "photoUrl" TEXT,
    CONSTRAINT "PurchaseReturnItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PurchaseReturnItem_purchaseReturnId_idx" ON "PurchaseReturnItem"("purchaseReturnId");
CREATE INDEX "PurchaseReturnItem_originalGrnItemId_idx" ON "PurchaseReturnItem"("originalGrnItemId");
CREATE INDEX "PurchaseReturnItem_medicineId_idx" ON "PurchaseReturnItem"("medicineId");
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "PurchaseReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
