-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('MANUFACTURER', 'DISTRIBUTOR', 'WHOLESALER', 'LOCAL_VENDOR');

-- DropIndex
DROP INDEX "Supplier_pharmacyId_name_key";

-- AlterTable
ALTER TABLE "Supplier" DROP COLUMN "contactPerson",
DROP COLUMN "email",
DROP COLUMN "name",
DROP COLUMN "paymentTermsDays",
DROP COLUMN "phone",
ADD COLUMN     "bankAccountDetails" JSONB,
ADD COLUMN     "companyName" TEXT NOT NULL,
ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'PKR',
ADD COLUMN     "drugLicenseExpiry" TIMESTAMP(3),
ADD COLUMN     "drugLicenseNumber" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentTermsCode" TEXT NOT NULL DEFAULT 'NET_30',
ADD COLUMN     "supplierType" "SupplierType" NOT NULL,
ADD COLUMN     "taxRegistrationNumber" TEXT,
ADD COLUMN     "tradingName" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" TEXT;

-- CreateTable
CREATE TABLE "SupplierContact" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SupplierContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierAddress" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postalCode" TEXT,

    CONSTRAINT "SupplierAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierDocument" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierMedicinePrice" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "negotiatedCost" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierMedicinePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicinePreferredSupplier" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "MedicinePreferredSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierContact_supplierId_idx" ON "SupplierContact"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierAddress_supplierId_idx" ON "SupplierAddress"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierDocument_supplierId_idx" ON "SupplierDocument"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierDocument_expiryDate_idx" ON "SupplierDocument"("expiryDate");

-- CreateIndex
CREATE INDEX "SupplierMedicinePrice_supplierId_medicineId_idx" ON "SupplierMedicinePrice"("supplierId", "medicineId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierMedicinePrice_supplierId_medicineId_effectiveFrom_key" ON "SupplierMedicinePrice"("supplierId", "medicineId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "MedicinePreferredSupplier_medicineId_idx" ON "MedicinePreferredSupplier"("medicineId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicinePreferredSupplier_pharmacyId_medicineId_supplierId_key" ON "MedicinePreferredSupplier"("pharmacyId", "medicineId", "supplierId");

-- CreateIndex
CREATE INDEX "Supplier_pharmacyId_isActive_idx" ON "Supplier"("pharmacyId", "isActive");

-- CreateIndex
CREATE INDEX "Supplier_pharmacyId_supplierType_idx" ON "Supplier"("pharmacyId", "supplierType");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_pharmacyId_companyName_key" ON "Supplier"("pharmacyId", "companyName");

-- AddForeignKey
ALTER TABLE "SupplierContact" ADD CONSTRAINT "SupplierContact_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAddress" ADD CONSTRAINT "SupplierAddress_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierMedicinePrice" ADD CONSTRAINT "SupplierMedicinePrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

