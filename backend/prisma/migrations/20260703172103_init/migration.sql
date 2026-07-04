-- CreateTable
CREATE TABLE "DashboardWidgetPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT,
    "widgetKey" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardWidgetPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardAlertAcknowledgement" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "acknowledgedBy" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "DashboardAlertAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardSnapshotCache" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "widgetKey" TEXT NOT NULL,
    "dateRangeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardSnapshotCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medicine" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reorderLevel" INTEGER NOT NULL DEFAULT 10,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Medicine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicineBatch" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "MedicineBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacySettings" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "branchId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "expiryThresholdDays" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DashboardWidgetPreference_pharmacyId_branchId_idx" ON "DashboardWidgetPreference"("pharmacyId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardWidgetPreference_userId_widgetKey_branchId_key" ON "DashboardWidgetPreference"("userId", "widgetKey", "branchId");

-- CreateIndex
CREATE INDEX "DashboardAlertAcknowledgement_pharmacyId_branchId_alertType_idx" ON "DashboardAlertAcknowledgement"("pharmacyId", "branchId", "alertType");

-- CreateIndex
CREATE INDEX "DashboardAlertAcknowledgement_referenceId_idx" ON "DashboardAlertAcknowledgement"("referenceId");

-- CreateIndex
CREATE INDEX "DashboardSnapshotCache_expiresAt_idx" ON "DashboardSnapshotCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardSnapshotCache_pharmacyId_branchId_widgetKey_dateRa_key" ON "DashboardSnapshotCache"("pharmacyId", "branchId", "widgetKey", "dateRangeKey");

-- CreateIndex
CREATE INDEX "Sale_pharmacyId_branchId_saleDate_idx" ON "Sale"("pharmacyId", "branchId", "saleDate");

-- CreateIndex
CREATE INDEX "SaleItem_medicineId_idx" ON "SaleItem"("medicineId");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "Medicine_pharmacyId_branchId_currentStock_idx" ON "Medicine"("pharmacyId", "branchId", "currentStock");

-- CreateIndex
CREATE INDEX "MedicineBatch_pharmacyId_branchId_expiryDate_idx" ON "MedicineBatch"("pharmacyId", "branchId", "expiryDate");

-- CreateIndex
CREATE INDEX "PurchaseOrder_pharmacyId_branchId_status_idx" ON "PurchaseOrder"("pharmacyId", "branchId", "status");

-- CreateIndex
CREATE INDEX "Expense_pharmacyId_branchId_expenseDate_idx" ON "Expense"("pharmacyId", "branchId", "expenseDate");

-- CreateIndex
CREATE INDEX "AuditLog_pharmacyId_branchId_createdAt_idx" ON "AuditLog"("pharmacyId", "branchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacySettings_pharmacyId_key" ON "PharmacySettings"("pharmacyId");

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
