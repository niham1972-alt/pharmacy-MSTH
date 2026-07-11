import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BatchesService } from '../../batches/batches.service';

/**
 * Ownership-preserving seam: Module 9 never touches stock/batch tables directly.
 * It delegates removal to Module 6's BatchService, which decrements the specific
 * batch and records the offsetting Module 5 `PURCHASE_RETURN` ledger OUT — inside
 * the return's transaction.
 */
@Injectable()
export class InventoryRemovalService {
  constructor(private readonly batches: BatchesService) {}

  remove(
    tx: Prisma.TransactionClient,
    params: { pharmacyId: string; branchId: string; purchaseReturnId: string; performedBy: string; items: Array<{ medicineId: string; batchId: string | null; quantity: number; unitCost: number }> },
  ) {
    return this.batches.recordSupplierReturnOut(
      { pharmacyId: params.pharmacyId, branchId: params.branchId, items: params.items, referenceId: params.purchaseReturnId, performedBy: params.performedBy, notes: 'Purchase return to supplier' },
      tx,
    );
  }
}
