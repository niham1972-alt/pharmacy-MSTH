-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_pharmacyId_name_idx" ON "Customer"("pharmacyId", "name");

-- CreateIndex
CREATE INDEX "Customer_pharmacyId_phone_idx" ON "Customer"("pharmacyId", "phone");

