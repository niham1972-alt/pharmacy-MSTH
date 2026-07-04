import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Stock-decrement seam. Sales never own stock logic — this routes through here
 * so Module 5 (Inventory) becomes the single source of stock-mutation truth
 * when it lands. Today it decrements the transitional `Medicine.currentStock`.
 * Always uses the caller's transaction client so a failed finalize rolls the
 * stock change back.
 */
@Injectable()
export class InventoryDecrementService {
  async decrement(tx: Prisma.TransactionClient, medicineId: string, quantity: number) {
    await tx.medicine.update({ where: { id: medicineId }, data: { currentStock: { decrement: quantity } } });
  }

  async increment(tx: Prisma.TransactionClient, medicineId: string, quantity: number) {
    await tx.medicine.update({ where: { id: medicineId }, data: { currentStock: { increment: quantity } } });
  }
}
