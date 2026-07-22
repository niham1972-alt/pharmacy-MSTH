-- Module 14: Reports & Analytics — read-only aggregation layer.
-- Adds only this module's own configuration/scheduling + pre-aggregation tables.
-- No changes to any other module's tables (it reads them, never writes).

CREATE TYPE "ExportJobStatus" AS ENUM ('GENERATING', 'READY', 'FAILED');

-- SavedReportConfiguration --------------------------------------------------
CREATE TABLE "SavedReportConfiguration" (
  "id"         TEXT NOT NULL,
  "pharmacyId" TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "reportType" TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "filters"    JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedReportConfiguration_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SavedReportConfiguration_pharmacyId_userId_idx" ON "SavedReportConfiguration"("pharmacyId", "userId");

-- ReportExportJob -----------------------------------------------------------
CREATE TABLE "ReportExportJob" (
  "id"          TEXT NOT NULL,
  "pharmacyId"  TEXT NOT NULL,
  "reportType"  TEXT NOT NULL,
  "filters"     JSONB NOT NULL,
  "format"      TEXT NOT NULL,
  "status"      "ExportJobStatus" NOT NULL DEFAULT 'GENERATING',
  "fileUrl"     TEXT,
  "fileName"    TEXT,
  "error"       TEXT,
  "requestedBy" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ReportExportJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReportExportJob_pharmacyId_requestedBy_createdAt_idx" ON "ReportExportJob"("pharmacyId", "requestedBy", "createdAt");

-- DailySalesSummary ---------------------------------------------------------
CREATE TABLE "DailySalesSummary" (
  "id"                 TEXT NOT NULL,
  "pharmacyId"         TEXT NOT NULL,
  "branchId"           TEXT NOT NULL,
  "date"               TIMESTAMP(3) NOT NULL,
  "totalRevenue"       DECIMAL(14,2) NOT NULL,
  "totalCost"          DECIMAL(14,2) NOT NULL,
  "totalTax"           DECIMAL(14,2) NOT NULL,
  "transactionCount"   INTEGER NOT NULL,
  "totalReturnsAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  CONSTRAINT "DailySalesSummary_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DailySalesSummary_pharmacyId_branchId_date_key" ON "DailySalesSummary"("pharmacyId", "branchId", "date");
CREATE INDEX "DailySalesSummary_pharmacyId_branchId_date_idx" ON "DailySalesSummary"("pharmacyId", "branchId", "date");

-- DailyExpenseSummary -------------------------------------------------------
CREATE TABLE "DailyExpenseSummary" (
  "id"          TEXT NOT NULL,
  "pharmacyId"  TEXT NOT NULL,
  "branchId"    TEXT NOT NULL,
  "date"        TIMESTAMP(3) NOT NULL,
  "categoryId"  TEXT NOT NULL,
  "totalAmount" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "DailyExpenseSummary_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DailyExpenseSummary_pharmacyId_branchId_date_categoryId_key" ON "DailyExpenseSummary"("pharmacyId", "branchId", "date", "categoryId");
CREATE INDEX "DailyExpenseSummary_pharmacyId_branchId_date_idx" ON "DailyExpenseSummary"("pharmacyId", "branchId", "date");
