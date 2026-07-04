import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface BatchAllocation {
  batchId: string;
  quantity: number;
}

/**
 * FEFO (First-Expiry-First-Out) batch selection. Owned by Module 6 (Batch &
 * Expiry) in the final architecture — this is the seam: swap the body for a
 * call to its BatchService and everything upstream is unchanged. Operates
 * inside the caller's `$transaction` and decrements batch quantities as it
 * allocates. A manual batch override (pharmacist/admin) is drawn first.
 */
@Injectable()
export class BatchFefoService {
  async allocate(
    tx: Prisma.TransactionClient,
    params: { pharmacyId: string; branchId: string; medicineId: string; quantity: number; manualBatchId?: string },
  ): Promise<BatchAllocation[]> {
    const batches = await tx.medicineBatch.findMany({
      where: { pharmacyId: params.pharmacyId, branchId: params.branchId, medicineId: params.medicineId, quantity: { gt: 0 } },
      orderBy: { expiryDate: 'asc' }, // FEFO
    });

    // Manual override batch jumps to the front of the queue.
    const ordered = params.manualBatchId ? [...batches].sort((a, b) => (a.id === params.manualBatchId ? -1 : b.id === params.manualBatchId ? 1 : 0)) : batches;

    const allocations: BatchAllocation[] = [];
    let remaining = params.quantity;
    for (const batch of ordered) {
      if (remaining <= 0) break;
      const take = Math.min(batch.quantity, remaining);
      allocations.push({ batchId: batch.id, quantity: take });
      await tx.medicineBatch.update({ where: { id: batch.id }, data: { quantity: { decrement: take } } });
      remaining -= take;
    }
    // If batches don't fully cover (data still catching up to transitional
    // currentStock), the shortfall is left untracked at batch level — stock is
    // still authoritatively decremented by the inventory seam.
    return allocations;
  }

  async reverse(tx: Prisma.TransactionClient, batchId: string, quantity: number) {
    await tx.medicineBatch.update({ where: { id: batchId }, data: { quantity: { increment: quantity } } });
  }
}
