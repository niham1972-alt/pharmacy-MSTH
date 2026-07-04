-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'VOIDED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- DropForeignKey
ALTER TABLE "SaleItem" DROP CONSTRAINT "SaleItem_saleId_fkey";

-- AlterTable
ALTER TABLE "Sale" DROP COLUMN "paymentMethod",
DROP COLUMN "totalAmount",
ADD COLUMN     "cashierSessionId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "discountApprovedBy" TEXT,
ADD COLUMN     "discountTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "grandTotal" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "saleNumber" TEXT NOT NULL,
ADD COLUMN     "subTotal" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedBy" TEXT,
ALTER COLUMN "totalCost" SET DATA TYPE DECIMAL(14,2),
DROP COLUMN "status",
ADD COLUMN     "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED';

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "lineTotal" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "prescriptionReference" TEXT,
ADD COLUMN     "prescriptionVerifiedBy" TEXT,
ADD COLUMN     "taxRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SalePayment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "referenceNumber" TEXT,
    "tenderedAmount" DECIMAL(14,2),
    "changeDue" DECIMAL(14,2),

    CONSTRAINT "SalePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleComplianceRecord" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prescribingDoctor" TEXT,
    "patientName" TEXT,
    "patientIdNumber" TEXT,
    "quantityDispensed" INTEGER NOT NULL,
    "verifiedBy" TEXT NOT NULL,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleComplianceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashierSession" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "openingFloat" DECIMAL(14,2) NOT NULL,
    "expectedCash" DECIMAL(14,2),
    "actualCash" DECIMAL(14,2),
    "variance" DECIMAL(14,2),
    "status" "SessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "CashierSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkedSale" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "label" TEXT,
    "cartSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParkedSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalePayment_saleId_idx" ON "SalePayment"("saleId");

-- CreateIndex
CREATE INDEX "SaleComplianceRecord_saleId_idx" ON "SaleComplianceRecord"("saleId");

-- CreateIndex
CREATE INDEX "CashierSession_pharmacyId_branchId_cashierId_status_idx" ON "CashierSession"("pharmacyId", "branchId", "cashierId", "status");

-- CreateIndex
CREATE INDEX "ParkedSale_pharmacyId_branchId_cashierId_idx" ON "ParkedSale"("pharmacyId", "branchId", "cashierId");

-- CreateIndex
CREATE INDEX "Sale_cashierSessionId_idx" ON "Sale"("cashierSessionId");

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_pharmacyId_saleNumber_key" ON "Sale"("pharmacyId", "saleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_pharmacyId_idempotencyKey_key" ON "Sale"("pharmacyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SaleItem_batchId_idx" ON "SaleItem"("batchId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashierSessionId_fkey" FOREIGN KEY ("cashierSessionId") REFERENCES "CashierSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleComplianceRecord" ADD CONSTRAINT "SaleComplianceRecord_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

