import { Injectable } from '@nestjs/common';
import { Prisma, StockAdjustment } from '@prisma/client';
import { InventoryService } from '../../inventory/inventory.service';

const dec = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : typeof v === 'number' ? v : v.toNumber());

/**
 * The ONLY place in the system that mutates stock with the adjustment reason
 * codes. Runs inside the caller's transaction so the ledger entry and the
 * adjustment's status change are atomic — no approved adjustment can exist whose
 * stock effect didn't happen (spec §3). For DECREASE it goes through Module 5's
 * `recordStockOut`, which re-validates current stock (INSUFFICIENT_STOCK) at
 * approval time — this is what handles the "stale delta" edge case (spec §21).
 */
@Injectable()
export class InventoryAdjustmentService {
  constructor(private readonly inventory: InventoryService) {}

  async execute(tx: Prisma.TransactionClient, adj: StockAdjustment): Promise<void> {
    const base = {
      pharmacyId: adj.pharmacyId,
      branchId: adj.branchId,
      medicineId: adj.medicineId,
      batchId: adj.batchId ?? null,
      quantity: adj.quantity,
      unitCost: dec(adj.unitCostAtRequest),
      referenceModule: 'STOCK_ADJUSTMENT',
      referenceId: adj.id,
      performedBy: adj.approvedBy ?? adj.requestedBy,
      notes: `${adj.adjustmentNumber} · ${adj.reasonCode}${adj.reasonNote ? ` · ${adj.reasonNote}` : ''}`,
    };
    if (adj.direction === 'INCREASE') {
      await this.inventory.recordStockIn({ ...base, reasonCode: 'POSITIVE_ADJUSTMENT' }, tx);
    } else {
      await this.inventory.recordStockOut({ ...base, reasonCode: 'NEGATIVE_ADJUSTMENT' }, tx);
    }

    // Resolve the linked reconciliation (Module 5 owns the row; we set the
    // back-reference now that its variance has actually been actioned).
    if (adj.linkedReconciliationId) {
      await tx.stockReconciliation.updateMany({
        where: { id: adj.linkedReconciliationId, pharmacyId: adj.pharmacyId, resolvedByAdjustmentId: null },
        data: { resolvedByAdjustmentId: adj.id },
      });
    }
  }
}
