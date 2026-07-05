-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('FRESH', 'EXPIRING_SOON', 'EXPIRED', 'DEPLETED', 'RECALLED');

-- CreateEnum
CREATE TYPE "RecallResolutionStatus" AS ENUM ('QUARANTINED', 'RETURNED_TO_SUPPLIER', 'DESTROYED', 'RESOLVED_OTHER');

-- DropIndex
DROP INDEX "MedicineBatch_pharmacyId_branchId_expiryDate_idx";

-- AlterTable
ALTER TABLE "MedicineBatch" DROP COLUMN "quantity",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "currentQuantity" INTEGER NOT NULL,
ADD COLUMN     "expiryOverridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expiryOverrideReason" TEXT,
ADD COLUMN     "isRecalled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manufactureDate" TIMESTAMP(3),
ADD COLUMN     "receivedQuantity" INTEGER NOT NULL,
ADD COLUMN     "sourceGrnId" TEXT,
ADD COLUMN     "sourceGrnItemId" TEXT,
ADD COLUMN     "status" "BatchStatus" NOT NULL DEFAULT 'FRESH',
ADD COLUMN     "unitCostAtReceipt" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "BatchWriteOff" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "quantityWrittenOff" INTEGER NOT NULL,
    "disposalMethod" TEXT NOT NULL,
    "disposalReference" TEXT,
    "writtenOffBy" TEXT NOT NULL,
    "writtenOffAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "BatchWriteOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchRecall" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceReference" TEXT,
    "flaggedBy" TEXT NOT NULL,
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolutionStatus" "RecallResolutionStatus" NOT NULL DEFAULT 'QUARANTINED',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "BatchRecall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BatchWriteOff_pharmacyId_branchId_idx" ON "BatchWriteOff"("pharmacyId", "branchId");

-- CreateIndex
CREATE INDEX "BatchWriteOff_batchId_idx" ON "BatchWriteOff"("batchId");

-- CreateIndex
CREATE INDEX "BatchRecall_pharmacyId_idx" ON "BatchRecall"("pharmacyId");

-- CreateIndex
CREATE INDEX "BatchRecall_batchId_idx" ON "BatchRecall"("batchId");

-- CreateIndex
CREATE INDEX "MedicineBatch_pharmacyId_branchId_medicineId_expiryDate_idx" ON "MedicineBatch"("pharmacyId", "branchId", "medicineId", "expiryDate");

-- CreateIndex
CREATE INDEX "MedicineBatch_pharmacyId_branchId_status_idx" ON "MedicineBatch"("pharmacyId", "branchId", "status");

-- CreateIndex
CREATE INDEX "MedicineBatch_expiryDate_idx" ON "MedicineBatch"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "MedicineBatch_pharmacyId_branchId_medicineId_batchNumber_key" ON "MedicineBatch"("pharmacyId", "branchId", "medicineId", "batchNumber");

-- AddForeignKey
ALTER TABLE "BatchWriteOff" ADD CONSTRAINT "BatchWriteOff_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MedicineBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRecall" ADD CONSTRAINT "BatchRecall_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MedicineBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

