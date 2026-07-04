import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Stock mutation seam. Purchase Management never owns stock logic — it goes
 * through here so that when Module 5 (Inventory) lands, this becomes a call to
 * its ledger-writing service (single source of stock-mutation truth). Today it
 * increments the transitional `Medicine.currentStock`. Always uses the caller's
 * transaction client so stock changes roll back with the GRN if anything fails.
 */
@Injectable()
export class InventorySyncService {
  async incrementStock(tx: Prisma.TransactionClient, medicineId: string, quantity: number) {
    await tx.medicine.update({
      where: { id: medicineId },
      data: { currentStock: { increment: quantity } },
    });
  }
}
