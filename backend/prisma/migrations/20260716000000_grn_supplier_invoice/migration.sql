-- GRN header: capture the supplier's own invoice number + date alongside our
-- internal GRN number. Additive & data-preserving (both nullable).
ALTER TABLE "GoodsReceipt"
  ADD COLUMN "supplierInvoiceNumber" TEXT,
  ADD COLUMN "supplierInvoiceDate"   TIMESTAMP(3);
