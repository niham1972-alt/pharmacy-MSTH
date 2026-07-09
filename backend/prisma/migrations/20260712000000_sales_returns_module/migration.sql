-- Module 10: Sales Returns — additive only (no changes to Modules 1–9 tables).

-- Enums
CREATE TYPE "RefundMethod" AS ENUM ('CASH', 'CARD', 'STORE_CREDIT', 'EXCHANGE', 'NO_REFUND');
CREATE TYPE "ConditionAssessment" AS ENUM ('RESALEABLE', 'NOT_RESALEABLE');
CREATE TYPE "ReturnReasonCode" AS ENUM ('CUSTOMER_CHANGED_MIND', 'INCORRECT_ITEM_DISPENSED', 'ADVERSE_REACTION', 'DAMAGED_DEFECTIVE', 'PRESCRIPTION_CHANGED', 'OTHER');

-- SalesReturn
CREATE TABLE "SalesReturn" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "originalSaleId" TEXT NOT NULL,
    "customerId" TEXT,
    "processedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRefundAmount" DECIMAL(14,2) NOT NULL,
    "refundMethod" "RefundMethod" NOT NULL,
    "refundReference" TEXT,
    "exchangeSaleId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesReturn_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SalesReturn_pharmacyId_returnNumber_key" ON "SalesReturn"("pharmacyId", "returnNumber");
CREATE INDEX "SalesReturn_pharmacyId_branchId_returnDate_idx" ON "SalesReturn"("pharmacyId", "branchId", "returnDate");
CREATE INDEX "SalesReturn_originalSaleId_idx" ON "SalesReturn"("originalSaleId");
CREATE INDEX "SalesReturn_customerId_idx" ON "SalesReturn"("customerId");

-- SalesReturnItem
CREATE TABLE "SalesReturnItem" (
    "id" TEXT NOT NULL,
    "salesReturnId" TEXT NOT NULL,
    "originalSaleItemId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "batchId" TEXT,
    "quantityReturned" INTEGER NOT NULL,
    "unitPriceAtSale" DECIMAL(12,2) NOT NULL,
    "refundAmountForLine" DECIMAL(14,2) NOT NULL,
    "conditionAssessment" "ConditionAssessment" NOT NULL,
    "reasonCode" "ReturnReasonCode" NOT NULL,
    "reasonNote" TEXT,
    "conditionPhotoUrl" TEXT,
    "restoredToStock" BOOLEAN NOT NULL DEFAULT false,
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SalesReturnItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalesReturnItem_salesReturnId_idx" ON "SalesReturnItem"("salesReturnId");
CREATE INDEX "SalesReturnItem_originalSaleItemId_idx" ON "SalesReturnItem"("originalSaleItemId");
CREATE INDEX "SalesReturnItem_medicineId_idx" ON "SalesReturnItem"("medicineId");
ALTER TABLE "SalesReturnItem" ADD CONSTRAINT "SalesReturnItem_salesReturnId_fkey" FOREIGN KEY ("salesReturnId") REFERENCES "SalesReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- StoreCreditBalance
CREATE TABLE "StoreCreditBalance" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreCreditBalance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoreCreditBalance_pharmacyId_customerId_key" ON "StoreCreditBalance"("pharmacyId", "customerId");

-- StoreCreditLedgerEntry
CREATE TABLE "StoreCreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "referenceModule" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreCreditLedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StoreCreditLedgerEntry_pharmacyId_customerId_createdAt_idx" ON "StoreCreditLedgerEntry"("pharmacyId", "customerId", "createdAt");
