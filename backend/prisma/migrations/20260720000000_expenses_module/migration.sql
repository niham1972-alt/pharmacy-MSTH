-- Module 13: Expenses Management — AUTHORITATIVE.
-- Supersedes the Module 1 stub `Expense` model (stub carried no operational data,
-- so it is dropped and rebuilt). Adds categories, recurring templates, partial
-- payments, and an approval workflow. Consolidated payables READ Module 3 (no DDL).

-- Drop the Module 1 stub (empty on a fresh instance; superseded here).
DROP TABLE "Expense";

-- Enums --------------------------------------------------------------------
CREATE TYPE "ExpensePaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');
CREATE TYPE "ExpenseApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');
CREATE TYPE "ExpenseRecurrenceFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUALLY');

-- ExpenseCategory ----------------------------------------------------------
CREATE TABLE "ExpenseCategory" (
  "id"         TEXT NOT NULL,
  "pharmacyId" TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "parentId"   TEXT,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExpenseCategory_pharmacyId_name_parentId_key" ON "ExpenseCategory"("pharmacyId", "name", "parentId");
CREATE INDEX "ExpenseCategory_pharmacyId_isActive_idx" ON "ExpenseCategory"("pharmacyId", "isActive");

-- RecurringExpenseTemplate -------------------------------------------------
CREATE TABLE "RecurringExpenseTemplate" (
  "id"                  TEXT NOT NULL,
  "pharmacyId"          TEXT NOT NULL,
  "branchId"            TEXT NOT NULL,
  "categoryId"          TEXT NOT NULL,
  "payeeName"           TEXT NOT NULL,
  "defaultAmount"       DECIMAL(12,2),
  "recurrenceFrequency" "ExpenseRecurrenceFrequency" NOT NULL,
  "dayOfPeriod"         INTEGER NOT NULL,
  "notes"               TEXT,
  "isActive"            BOOLEAN NOT NULL DEFAULT true,
  "startedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt"             TIMESTAMP(3),
  "lastGeneratedPeriod" TEXT,
  "createdBy"           TEXT NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecurringExpenseTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RecurringExpenseTemplate_pharmacyId_branchId_isActive_idx" ON "RecurringExpenseTemplate"("pharmacyId", "branchId", "isActive");

-- Expense ------------------------------------------------------------------
CREATE TABLE "Expense" (
  "id"                       TEXT NOT NULL,
  "pharmacyId"              TEXT NOT NULL,
  "branchId"                TEXT NOT NULL,
  "expenseNumber"           TEXT NOT NULL,
  "categoryId"              TEXT NOT NULL,
  "payeeName"               TEXT NOT NULL,
  "amount"                  DECIMAL(12,2) NOT NULL,
  "incurredDate"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate"                 TIMESTAMP(3),
  "paymentStatus"           "ExpensePaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "amountPaid"              DECIMAL(12,2) NOT NULL DEFAULT 0,
  "approvalStatus"          "ExpenseApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "approvedBy"              TEXT,
  "approvedAt"              TIMESTAMP(3),
  "rejectedReason"          TEXT,
  "generatedFromTemplateId" TEXT,
  "periodKey"               TEXT,
  "receiptUrl"              TEXT,
  "notes"                   TEXT,
  "createdBy"               TEXT NOT NULL,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Expense_pharmacyId_expenseNumber_key" ON "Expense"("pharmacyId", "expenseNumber");
-- Idempotency: at most one generated expense per template + period.
CREATE UNIQUE INDEX "Expense_generatedFromTemplateId_periodKey_key" ON "Expense"("generatedFromTemplateId", "periodKey");
CREATE INDEX "Expense_pharmacyId_branchId_incurredDate_idx" ON "Expense"("pharmacyId", "branchId", "incurredDate");
CREATE INDEX "Expense_pharmacyId_categoryId_idx" ON "Expense"("pharmacyId", "categoryId");
CREATE INDEX "Expense_pharmacyId_paymentStatus_dueDate_idx" ON "Expense"("pharmacyId", "paymentStatus", "dueDate");

-- ExpensePayment -----------------------------------------------------------
CREATE TABLE "ExpensePayment" (
  "id"              TEXT NOT NULL,
  "pharmacyId"      TEXT NOT NULL,
  "expenseId"       TEXT NOT NULL,
  "amount"          DECIMAL(12,2) NOT NULL,
  "paymentDate"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "method"          TEXT NOT NULL,
  "referenceNumber" TEXT,
  "notes"           TEXT,
  "recordedBy"      TEXT NOT NULL,
  CONSTRAINT "ExpensePayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExpensePayment_expenseId_idx" ON "ExpensePayment"("expenseId");

-- Foreign keys -------------------------------------------------------------
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecurringExpenseTemplate" ADD CONSTRAINT "RecurringExpenseTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_generatedFromTemplateId_fkey" FOREIGN KEY ("generatedFromTemplateId") REFERENCES "RecurringExpenseTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
