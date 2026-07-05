import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockDirection, StockReasonCode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryEventsEmitter } from './events/inventory-events.emitter';

const ALLOW_NEGATIVE_STOCK = process.env.ALLOW_NEGATIVE_STOCK === 'true';

export interface StockInParams {
  pharmacyId: string;
  branchId: string;
  medicineId: string;
  batchId?: string | null;
  quantity: number;
  unitCost?: number;
  reasonCode: StockReasonCode;
  referenceModule: string;
  referenceId: string;
  performedBy: string;
  notes?: string;
}

export type StockOutParams = Omit<StockInParams, 'unitCost'> & { unitCost?: number };

/**
 * THE authoritative owner of stock. `recordStockIn` / `recordStockOut` /
 * `reverseStockMovement` are the ONLY methods anywhere permitted to mutate stock
 * (spec §8/§11). Each runs inside a transaction, locks the medicine row
 * (`SELECT … FOR UPDATE` — do NOT remove; it prevents concurrent decrements
 * racing past zero), writes an immutable ledger entry, updates the `Inventory`
 * aggregate, and mirrors the value into `Medicine.currentStock` so existing
 * reads keep working. All methods accept an optional `tx` so callers
 * (Purchases GRN, Sales finalize) can enrol stock changes in THEIR transaction —
 * making the whole operation atomic.
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: InventoryEventsEmitter,
  ) {}

  private run<T>(tx: Prisma.TransactionClient | undefined, fn: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return tx ? fn(tx) : this.prisma.$transaction(fn);
  }

  /** Aggregate (medicine, branch) inventory row — held at batchId=null. */
  private async aggregateRow(tx: Prisma.TransactionClient, pharmacyId: string, branchId: string, medicineId: string) {
    const existing = await tx.inventory.findFirst({ where: { pharmacyId, branchId, medicineId, batchId: null } });
    if (existing) return existing;
    return tx.inventory.create({ data: { pharmacyId, branchId, medicineId, batchId: null, currentStock: 0 } });
  }

  async recordStockIn(params: StockInParams, tx?: Prisma.TransactionClient) {
    return this.run(tx, async (client) => {
      await client.$queryRaw`SELECT id FROM "Medicine" WHERE id = ${params.medicineId} FOR UPDATE`;
      const agg = await this.aggregateRow(client, params.pharmacyId, params.branchId, params.medicineId);
      const balanceAfter = agg.currentStock + params.quantity;
      await client.inventory.update({ where: { id: agg.id }, data: { currentStock: balanceAfter, lastMovementAt: new Date() } });
      await client.medicine.update({ where: { id: params.medicineId }, data: { currentStock: balanceAfter } });
      const entry = await client.stockLedgerEntry.create({
        data: {
          pharmacyId: params.pharmacyId,
          branchId: params.branchId,
          medicineId: params.medicineId,
          batchId: params.batchId ?? null,
          direction: StockDirection.IN,
          quantity: params.quantity,
          reasonCode: params.reasonCode,
          referenceModule: params.referenceModule,
          referenceId: params.referenceId,
          unitCostAtTime: params.unitCost,
          balanceAfter,
          performedBy: params.performedBy,
          notes: params.notes,
        },
      });
      this.events.stockUpdated({ pharmacyId: params.pharmacyId, branchId: params.branchId, medicineId: params.medicineId, currentStock: balanceAfter });
      return entry;
    });
  }

  async recordStockOut(params: StockOutParams, tx?: Prisma.TransactionClient) {
    return this.run(tx, async (client) => {
      await client.$queryRaw`SELECT id FROM "Medicine" WHERE id = ${params.medicineId} FOR UPDATE`;
      const agg = await this.aggregateRow(client, params.pharmacyId, params.branchId, params.medicineId);
      if (!ALLOW_NEGATIVE_STOCK && agg.currentStock < params.quantity) {
        throw new BadRequestException({ errorCode: 'INSUFFICIENT_STOCK', message: `Insufficient stock. Available: ${agg.currentStock}, required: ${params.quantity}.`, data: { available: agg.currentStock } });
      }
      const balanceAfter = agg.currentStock - params.quantity;
      await client.inventory.update({ where: { id: agg.id }, data: { currentStock: balanceAfter, lastMovementAt: new Date() } });
      await client.medicine.update({ where: { id: params.medicineId }, data: { currentStock: balanceAfter } });
      const entry = await client.stockLedgerEntry.create({
        data: {
          pharmacyId: params.pharmacyId,
          branchId: params.branchId,
          medicineId: params.medicineId,
          batchId: params.batchId ?? null,
          direction: StockDirection.OUT,
          quantity: params.quantity,
          reasonCode: params.reasonCode,
          referenceModule: params.referenceModule,
          referenceId: params.referenceId,
          unitCostAtTime: params.unitCost,
          balanceAfter,
          performedBy: params.performedBy,
          notes: balanceAfter < 0 ? `${params.notes ?? ''} [NEGATIVE STOCK]`.trim() : params.notes,
        },
      });
      this.events.stockUpdated({ pharmacyId: params.pharmacyId, branchId: params.branchId, medicineId: params.medicineId, currentStock: balanceAfter });
      return entry;
    });
  }

  async getCurrentStock(params: { pharmacyId: string; branchId: string; medicineId: string }): Promise<number> {
    const agg = await this.prisma.inventory.findFirst({ where: { pharmacyId: params.pharmacyId, branchId: params.branchId, medicineId: params.medicineId, batchId: null } });
    return agg?.currentStock ?? 0;
  }

  async checkSufficientStock(params: { pharmacyId: string; branchId: string; medicineId: string; requiredQuantity: number }): Promise<boolean> {
    if (ALLOW_NEGATIVE_STOCK) return true;
    return (await this.getCurrentStock(params)) >= params.requiredQuantity;
  }

  /** Corrections happen via an equal-and-opposite entry — the original is never
   * edited/deleted (spec §2.1/§11). Used by Sales void / Purchase cancel. */
  async reverseStockMovement(
    params: { originalLedgerEntryId: string; reasonCode: StockReasonCode; referenceModule: string; referenceId: string; performedBy: string; notes?: string },
    tx?: Prisma.TransactionClient,
  ) {
    const original = await this.prisma.stockLedgerEntry.findUnique({ where: { id: params.originalLedgerEntryId } });
    if (!original) throw new NotFoundException({ errorCode: 'LEDGER_ENTRY_NOT_FOUND', message: 'Original ledger entry not found' });
    const common = {
      pharmacyId: original.pharmacyId,
      branchId: original.branchId,
      medicineId: original.medicineId,
      batchId: original.batchId,
      quantity: original.quantity,
      reasonCode: params.reasonCode,
      referenceModule: params.referenceModule,
      referenceId: params.referenceId,
      performedBy: params.performedBy,
      notes: params.notes ?? `Reversal of ${original.id}`,
    };
    return original.direction === StockDirection.OUT ? this.recordStockIn(common, tx) : this.recordStockOut(common, tx);
  }
}
