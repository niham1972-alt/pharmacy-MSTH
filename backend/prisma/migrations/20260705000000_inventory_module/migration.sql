-- CreateEnum
CREATE TYPE "StockDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "StockReasonCode" AS ENUM ('PURCHASE_RECEIPT', 'SALE', 'SALES_RETURN', 'PURCHASE_RETURN', 'POSITIVE_ADJUSTMENT', 'NEGATIVE_ADJUSTMENT', 'EXPIRY_WRITE_OFF', 'DAMAGE_WRITE_OFF', 'TRANSFER_IN', 'TRANSFER_OUT', 'OPENING_STOCK');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "batchId" TEXT,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "lastMovementAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLedgerEntry" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "batchId" TEXT,
    "direction" "StockDirection" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reasonCode" "StockReasonCode" NOT NULL,
    "referenceModule" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "unitCostAtTime" DECIMAL(12,2),
    "balanceAfter" INTEGER NOT NULL,
    "performedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "sourceBranchId" TEXT NOT NULL,
    "destBranchId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "initiatedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "receivedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "batchId" TEXT,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReconciliation" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "batchId" TEXT,
    "expectedQuantity" INTEGER NOT NULL,
    "countedQuantity" INTEGER NOT NULL,
    "variance" INTEGER NOT NULL,
    "countedBy" TEXT NOT NULL,
    "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedByAdjustmentId" TEXT,
    "notes" TEXT,

    CONSTRAINT "StockReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inventory_pharmacyId_branchId_medicineId_idx" ON "Inventory"("pharmacyId", "branchId", "medicineId");

-- CreateIndex
CREATE INDEX "Inventory_pharmacyId_branchId_currentStock_idx" ON "Inventory"("pharmacyId", "branchId", "currentStock");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_pharmacyId_branchId_medicineId_batchId_key" ON "Inventory"("pharmacyId", "branchId", "medicineId", "batchId");

-- CreateIndex
CREATE INDEX "StockLedgerEntry_pharmacyId_branchId_medicineId_createdAt_idx" ON "StockLedgerEntry"("pharmacyId", "branchId", "medicineId", "createdAt");

-- CreateIndex
CREATE INDEX "StockLedgerEntry_referenceModule_referenceId_idx" ON "StockLedgerEntry"("referenceModule", "referenceId");

-- CreateIndex
CREATE INDEX "StockLedgerEntry_batchId_idx" ON "StockLedgerEntry"("batchId");

-- CreateIndex
CREATE INDEX "StockTransfer_pharmacyId_sourceBranchId_status_idx" ON "StockTransfer"("pharmacyId", "sourceBranchId", "status");

-- CreateIndex
CREATE INDEX "StockTransfer_pharmacyId_destBranchId_status_idx" ON "StockTransfer"("pharmacyId", "destBranchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_pharmacyId_transferNumber_key" ON "StockTransfer"("pharmacyId", "transferNumber");

-- CreateIndex
CREATE INDEX "StockTransferItem_transferId_idx" ON "StockTransferItem"("transferId");

-- CreateIndex
CREATE INDEX "StockReconciliation_pharmacyId_branchId_medicineId_idx" ON "StockReconciliation"("pharmacyId", "branchId", "medicineId");

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

