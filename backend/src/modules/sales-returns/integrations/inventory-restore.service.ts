import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BatchesService } from '../../batches/batches.service';

/**
 * Ownership-preserving seam: Module 10 never touches stock or batch tables
 * directly. It delegates RESALEABLE restoration to Module 6's BatchService, which
 * restores the ORIGINAL batch's quantity and records the offsetting Module 5
 * `SALES_RETURN` ledger IN — all inside the return's transaction.
 */
@Injectable()
export class InventoryRestoreService {
  constructor(private readonly batches: BatchesService) {}

  restore(
    tx: Prisma.TransactionClient,
    params: { pharmacyId: string; branchId: string; salesReturnId: string; performedBy: string; items: Array<{ medicineId: string; batchId: string | null; quantity: number }> },
  ) {
    if (params.items.length === 0) return Promise.resolve([]);
    return this.batches.restoreReturnedStock(
      { pharmacyId: params.pharmacyId, branchId: params.branchId, items: params.items, referenceId: params.salesReturnId, performedBy: params.performedBy, notes: 'Resaleable sales return' },
      tx,
    );
  }
}
