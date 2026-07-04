-- CreateEnum
CREATE TYPE "MedicineStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED');

-- DropIndex
DROP INDEX "Medicine_pharmacyId_branchId_currentStock_idx";

-- AlterTable
ALTER TABLE "Medicine" DROP COLUMN "name",
ADD COLUMN     "baseUnitId" TEXT NOT NULL,
ADD COLUMN     "brandName" TEXT,
ADD COLUMN     "categoryId" TEXT NOT NULL,
ADD COLUMN     "controlledSubstanceSchedule" TEXT,
ADD COLUMN     "costPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "discountEligible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "documentUrl" TEXT,
ADD COLUMN     "dosageFormId" TEXT NOT NULL,
ADD COLUMN     "genericName" TEXT NOT NULL,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "isGlobalAcrossBranches" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manufacturerId" TEXT NOT NULL,
ADD COLUMN     "maxStockLevel" INTEGER,
ADD COLUMN     "mrp" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "prescriptionRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "purchaseUnitId" TEXT NOT NULL,
ADD COLUMN     "reorderQuantity" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "routeOfAdministration" TEXT,
ADD COLUMN     "saleUnitId" TEXT NOT NULL,
ADD COLUMN     "sellingPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "sku" TEXT NOT NULL,
ADD COLUMN     "status" "MedicineStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "storageCondition" TEXT,
ADD COLUMN     "strength" TEXT,
ADD COLUMN     "subCategoryId" TEXT,
ADD COLUMN     "taxInclusive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "taxRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "therapeuticClass" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" TEXT,
ALTER COLUMN "branchId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "MedicineBarcode" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicineBarcode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicineUnitConversion" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "fromUnitId" TEXT NOT NULL,
    "toUnitId" TEXT NOT NULL,
    "conversionFactor" INTEGER NOT NULL,

    CONSTRAINT "MedicineUnitConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manufacturer" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "contactInfo" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DosageForm" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "DosageForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "priceType" TEXT NOT NULL,
    "oldValue" DECIMAL(12,2) NOT NULL,
    "newValue" DECIMAL(12,2) NOT NULL,
    "changedBy" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedicineBarcode_medicineId_idx" ON "MedicineBarcode"("medicineId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicineBarcode_pharmacyId_barcode_key" ON "MedicineBarcode"("pharmacyId", "barcode");

-- CreateIndex
CREATE INDEX "MedicineUnitConversion_medicineId_idx" ON "MedicineUnitConversion"("medicineId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_pharmacyId_name_key" ON "Unit"("pharmacyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_pharmacyId_name_parentId_key" ON "Category"("pharmacyId", "name", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Manufacturer_pharmacyId_name_key" ON "Manufacturer"("pharmacyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DosageForm_pharmacyId_name_key" ON "DosageForm"("pharmacyId", "name");

-- CreateIndex
CREATE INDEX "PriceHistory_medicineId_effectiveAt_idx" ON "PriceHistory"("medicineId", "effectiveAt");

-- CreateIndex
CREATE INDEX "Medicine_pharmacyId_branchId_isActive_idx" ON "Medicine"("pharmacyId", "branchId", "isActive");

-- CreateIndex
CREATE INDEX "Medicine_pharmacyId_categoryId_idx" ON "Medicine"("pharmacyId", "categoryId");

-- CreateIndex
CREATE INDEX "Medicine_pharmacyId_manufacturerId_idx" ON "Medicine"("pharmacyId", "manufacturerId");

-- CreateIndex
CREATE INDEX "Medicine_pharmacyId_currentStock_idx" ON "Medicine"("pharmacyId", "currentStock");

-- CreateIndex
CREATE UNIQUE INDEX "Medicine_pharmacyId_sku_key" ON "Medicine"("pharmacyId", "sku");

-- AddForeignKey
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_dosageFormId_fkey" FOREIGN KEY ("dosageFormId") REFERENCES "DosageForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_baseUnitId_fkey" FOREIGN KEY ("baseUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_purchaseUnitId_fkey" FOREIGN KEY ("purchaseUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_saleUnitId_fkey" FOREIGN KEY ("saleUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineBarcode" ADD CONSTRAINT "MedicineBarcode_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineUnitConversion" ADD CONSTRAINT "MedicineUnitConversion_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

