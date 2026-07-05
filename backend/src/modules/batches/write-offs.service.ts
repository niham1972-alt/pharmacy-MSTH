import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { InventoryService } from '../inventory/inventory.service';
import { BatchesService } from './batches.service';
import { BatchEventsEmitter } from './events/batch-events.emitter';
import { WriteOffBatchDto } from './dto/batches.dto';

function dec(v: Prisma.Decimal | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : v.toNumber();
}

/**
 * Expired-stock write-off. Permanent, append-only compliance record. Removes the
 * quantity from sellable inventory via Module 5 (reason EXPIRY_WRITE_OFF) inside
 * one transaction that also decrements the batch's `currentQuantity`.
 */
@Injectable()
export class WriteOffsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly batches: BatchesService,
    private readonly events: BatchEventsEmitter,
    private readonly audit: AuditLogService,
  ) {}

  async writeOff(user: AuthenticatedUser, dto: WriteOffBatchDto) {
    const results: Array<{ batchId: string; quantityWrittenOff: number }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const line of dto.batches) {
        const b = await tx.medicineBatch.findFirst({ where: { id: line.batchId, pharmacyId: user.pharmacyId } });
        if (!b) throw new NotFoundException({ errorCode: 'BATCH_NOT_FOUND', message: `Batch ${line.batchId} not found.` });
        if (!user.accessibleBranchIds.includes(b.branchId)) throw new ForbiddenException({ errorCode: 'BRANCH_ACCESS_DENIED', message: 'No access to that branch.' });
        if (b.currentQuantity <= 0) throw new BadRequestException({ errorCode: 'BATCH_DEPLETED', message: `Batch ${b.batchNumber} has already been fully depleted or written off.` });
        if (line.quantity > b.currentQuantity) throw new BadRequestException({ errorCode: 'WRITE_OFF_EXCEEDS_QUANTITY', message: `Cannot write off ${line.quantity} — only ${b.currentQuantity} remain in batch ${b.batchNumber}.` });

        const nextQty = b.currentQuantity - line.quantity;
        await tx.medicineBatch.update({
          where: { id: b.id },
          data: { currentQuantity: nextQty, status: this.batches.computeStatus({ isRecalled: b.isRecalled, currentQuantity: nextQty, expiryDate: b.expiryDate }) },
        });
        await this.inventory.recordStockOut(
          { pharmacyId: user.pharmacyId, branchId: b.branchId, medicineId: b.medicineId, batchId: b.id, quantity: line.quantity, unitCost: dec(b.unitCostAtReceipt), reasonCode: 'EXPIRY_WRITE_OFF', referenceModule: 'BATCH', referenceId: b.id, performedBy: user.userId, notes: `Write-off: ${dto.disposalMethod}` },
          tx,
        );
        await tx.batchWriteOff.create({
          data: { pharmacyId: user.pharmacyId, branchId: b.branchId, batchId: b.id, quantityWrittenOff: line.quantity, disposalMethod: dto.disposalMethod, disposalReference: dto.disposalReference, writtenOffBy: user.userId, notes: dto.notes },
        });
        results.push({ batchId: b.id, quantityWrittenOff: line.quantity });
      }
    });

    for (const r of results) {
      await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'BATCH_WRITTEN_OFF', entityType: 'MEDICINE_BATCH', entityId: r.batchId, metadata: { quantity: r.quantityWrittenOff, disposalMethod: dto.disposalMethod, disposalReference: dto.disposalReference } });
      this.events.writtenOff({ pharmacyId: user.pharmacyId, branchId: user.branchId, batchId: r.batchId, quantity: r.quantityWrittenOff });
    }
    return { writtenOff: results.length, batches: results };
  }

  async history(user: AuthenticatedUser, branchId?: string) {
    const scope = branchId ?? user.branchId;
    const rows = await this.prisma.batchWriteOff.findMany({ where: { pharmacyId: user.pharmacyId, branchId: scope }, orderBy: { writtenOffAt: 'desc' }, take: 200, include: { batch: { select: { batchNumber: true, medicineId: true } } } });
    const meds = await this.prisma.medicine.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.batch.medicineId))] } }, select: { id: true, brandName: true, genericName: true } });
    const nameOf = new Map(meds.map((m) => [m.id, m.brandName ?? m.genericName]));
    return rows.map((w) => ({
      id: w.id,
      batchId: w.batchId,
      batchNumber: w.batch.batchNumber,
      medicineName: nameOf.get(w.batch.medicineId) ?? w.batch.medicineId,
      quantityWrittenOff: w.quantityWrittenOff,
      disposalMethod: w.disposalMethod,
      disposalReference: w.disposalReference,
      writtenOffBy: w.writtenOffBy,
      writtenOffAt: w.writtenOffAt.toISOString(),
      notes: w.notes,
    }));
  }
}
