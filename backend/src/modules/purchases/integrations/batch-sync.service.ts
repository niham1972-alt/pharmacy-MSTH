import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Purchase Management is the ORIGIN of all batch records. Today it writes the
 * `MedicineBatch` stub directly; when Module 6 (Batch & Expiry) lands, swap the
 * body for a call to its BatchService interface — the signature stays identical
 * so no GRN-service change is needed. Always operates inside the caller's
 * `$transaction` client (`tx`).
 */
@Injectable()
export class BatchSyncService {
  async createBatch(
    tx: Prisma.TransactionClient,
    data: { pharmacyId: string; branchId: string; medicineId: string; batchNumber: string; quantity: number; expiryDate: Date },
  ) {
    return tx.medicineBatch.create({ data });
  }
}
