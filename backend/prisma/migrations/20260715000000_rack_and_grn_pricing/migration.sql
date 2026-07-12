-- Module 2/3 extension: Rack storage locations + richer GRN pricing (loose units,
-- bonus, per-line & invoice-level discount / sales tax / advance tax).
-- Additive & data-preserving: existing rows keep working (all new columns default).

-- Enum: how a discount/tax value is interpreted (percentage vs flat amount).
CREATE TYPE "TaxDiscountMode" AS ENUM ('PERCENT', 'AMOUNT');

-- Rack lookup table.
CREATE TABLE "Rack" (
  "id"          TEXT NOT NULL,
  "pharmacyId"  TEXT NOT NULL,
  "branchId"    TEXT,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Rack_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Rack_pharmacyId_name_key" ON "Rack"("pharmacyId", "name");
CREATE INDEX "Rack_pharmacyId_isActive_idx" ON "Rack"("pharmacyId", "isActive");

-- Medicine: default shelf/rack.
ALTER TABLE "Medicine" ADD COLUMN "rackId" TEXT;
ALTER TABLE "Medicine"
  ADD CONSTRAINT "Medicine_rackId_fkey" FOREIGN KEY ("rackId")
  REFERENCES "Rack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- GoodsReceiptItem: loose units, rack placement, per-line pricing adjustments.
ALTER TABLE "GoodsReceiptItem"
  ADD COLUMN "looseUnitQuantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rackId"            TEXT,
  ADD COLUMN "discountMode"      "TaxDiscountMode" NOT NULL DEFAULT 'AMOUNT',
  ADD COLUMN "discountValue"     DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "salesTaxMode"      "TaxDiscountMode" NOT NULL DEFAULT 'PERCENT',
  ADD COLUMN "salesTaxValue"     DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "advanceTaxMode"    "TaxDiscountMode" NOT NULL DEFAULT 'AMOUNT',
  ADD COLUMN "advanceTaxValue"   DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "lineNetTotal"      DECIMAL(14,2) NOT NULL DEFAULT 0;

-- GoodsReceipt: invoice-level (bulk) adjustments + stored totals.
ALTER TABLE "GoodsReceipt"
  ADD COLUMN "invoiceDiscountMode"    "TaxDiscountMode" NOT NULL DEFAULT 'AMOUNT',
  ADD COLUMN "invoiceDiscountValue"   DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "invoiceSalesTaxMode"    "TaxDiscountMode" NOT NULL DEFAULT 'PERCENT',
  ADD COLUMN "invoiceSalesTaxValue"   DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "invoiceAdvanceTaxMode"  "TaxDiscountMode" NOT NULL DEFAULT 'AMOUNT',
  ADD COLUMN "invoiceAdvanceTaxValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "subTotal"               DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "grandTotal"             DECIMAL(14,2) NOT NULL DEFAULT 0;
