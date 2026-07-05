import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RecallResolutionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { BatchesService } from './batches.service';
import { BatchEventsEmitter } from './events/batch-events.emitter';
import { FlagRecallDto, ResolveRecallDto } from './dto/batches.dto';

/**
 * Batch recall. Flagging sets `isRecalled` so `isBatchSellable()` blocks the
 * batch at every sale path immediately. Idempotent: re-flagging an already-
 * recalled batch returns the existing active record. Records are append-only.
 */
@Injectable()
export class RecallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly batches: BatchesService,
    private readonly events: BatchEventsEmitter,
    private readonly audit: AuditLogService,
  ) {}

  async flag(user: AuthenticatedUser, batchId: string, dto: FlagRecallDto) {
    const b = await this.prisma.medicineBatch.findFirst({ where: { id: batchId, pharmacyId: user.pharmacyId } });
    if (!b) throw new NotFoundException({ errorCode: 'BATCH_NOT_FOUND', message: 'Batch not found' });
    if (!user.accessibleBranchIds.includes(b.branchId)) throw new ForbiddenException({ errorCode: 'BRANCH_ACCESS_DENIED', message: 'No access to that branch.' });

    // Idempotent — an already-recalled batch returns its active recall record.
    if (b.isRecalled) {
      const existing = await this.prisma.batchRecall.findFirst({ where: { batchId, resolvedAt: null }, orderBy: { flaggedAt: 'desc' } });
      if (existing) return { id: existing.id, batchId, alreadyRecalled: true, resolutionStatus: existing.resolutionStatus };
    }

    const recall = await this.prisma.$transaction(async (tx) => {
      await tx.medicineBatch.update({ where: { id: batchId }, data: { isRecalled: true, status: 'RECALLED' } });
      return tx.batchRecall.create({ data: { pharmacyId: user.pharmacyId, batchId, reason: dto.reason, sourceReference: dto.sourceReference, flaggedBy: user.userId, notes: dto.notes } });
    });

    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: b.branchId, userId: user.userId, action: 'BATCH_RECALLED', entityType: 'MEDICINE_BATCH', entityId: batchId, metadata: { reason: dto.reason, sourceReference: dto.sourceReference } });
    this.events.recalled({ pharmacyId: user.pharmacyId, branchId: b.branchId, batchId });
    return { id: recall.id, batchId, alreadyRecalled: false, resolutionStatus: recall.resolutionStatus };
  }

  async resolve(user: AuthenticatedUser, recallId: string, dto: ResolveRecallDto) {
    const recall = await this.prisma.batchRecall.findFirst({ where: { id: recallId, pharmacyId: user.pharmacyId }, include: { batch: true } });
    if (!recall) throw new NotFoundException({ errorCode: 'RECALL_NOT_FOUND', message: 'Recall record not found' });
    if (recall.resolvedAt) throw new BadRequestException({ errorCode: 'RECALL_ALREADY_RESOLVED', message: 'This recall is already resolved.' });

    await this.prisma.batchRecall.update({ where: { id: recallId }, data: { resolutionStatus: dto.resolutionStatus as RecallResolutionStatus, resolvedAt: new Date(), resolvedBy: user.userId, notes: dto.notes ?? recall.notes } });
    // The batch stays isRecalled=true — resolution documents the outcome, it does
    // not make a recalled lot sellable again (that requires a Stock Adjustment).
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: recall.batch.branchId, userId: user.userId, action: 'BATCH_RECALL_RESOLVED', entityType: 'BATCH_RECALL', entityId: recallId, metadata: { resolutionStatus: dto.resolutionStatus } });
    return { id: recallId, resolutionStatus: dto.resolutionStatus, resolved: true };
  }

  async list(user: AuthenticatedUser) {
    const rows = await this.prisma.batchRecall.findMany({ where: { pharmacyId: user.pharmacyId }, orderBy: { flaggedAt: 'desc' }, take: 200, include: { batch: { select: { batchNumber: true, medicineId: true, branchId: true, currentQuantity: true } } } });
    const meds = await this.prisma.medicine.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.batch.medicineId))] } }, select: { id: true, brandName: true, genericName: true } });
    const nameOf = new Map(meds.map((m) => [m.id, m.brandName ?? m.genericName]));
    return rows.map((r) => ({
      id: r.id,
      batchId: r.batchId,
      batchNumber: r.batch.batchNumber,
      medicineName: nameOf.get(r.batch.medicineId) ?? r.batch.medicineId,
      quantityAffected: r.batch.currentQuantity,
      reason: r.reason,
      sourceReference: r.sourceReference,
      flaggedBy: r.flaggedBy,
      flaggedAt: r.flaggedAt.toISOString(),
      resolutionStatus: r.resolutionStatus,
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
    }));
  }

  /** Sales that dispensed the recalled batch before it was flagged (spec §2.5). */
  async affectedSales(user: AuthenticatedUser, recallId: string) {
    const recall = await this.prisma.batchRecall.findFirst({ where: { id: recallId, pharmacyId: user.pharmacyId } });
    if (!recall) throw new NotFoundException({ errorCode: 'RECALL_NOT_FOUND', message: 'Recall record not found' });
    const saleItems = await this.prisma.saleItem.findMany({ where: { batchId: recall.batchId }, include: { sale: { select: { id: true, saleNumber: true, saleDate: true, status: true, customerId: true } } }, orderBy: { sale: { saleDate: 'desc' } } });
    return saleItems.map((si) => ({ saleId: si.sale.id, saleNumber: si.sale.saleNumber, saleDate: si.sale.saleDate.toISOString(), status: si.sale.status, customerId: si.sale.customerId, quantity: si.quantity }));
  }
}
