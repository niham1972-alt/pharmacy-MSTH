import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BatchStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { InventoryService } from '../inventory/inventory.service';
import { BatchEventsEmitter } from './events/batch-events.emitter';
import { QueryBatchesDto } from './dto/batches.dto';

// Tiered expiry scheme (matches Module 1 Dashboard colours). Days-to-expiry:
//   red < 30 · orange 30–90 · yellow 90–180 · fresh > 180.
const TIER_RED = 30;
const TIER_ORANGE = 90;
const EXPIRING_SOON_MAX = 180;

function dec(v: Prisma.Decimal | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : v.toNumber();
}

export interface CreateOrAppendBatchParams {
  pharmacyId: string;
  branchId: string;
  medicineId: string;
  batchNumber: string;
  expiryDate: Date | string;
  manufactureDate?: Date | string | null;
  quantity: number;
  unitCost: number;
  sourceGrnId?: string | null;
  sourceGrnItemId?: string | null;
  expiryOverridden?: boolean;
  expiryOverrideReason?: string | null;
  referenceModule?: string;
  referenceId?: string;
  performedBy: string;
}

export interface FefoAllocationLine {
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  quantityFromBatch: number;
}

export interface AllocateAndConsumeParams {
  pharmacyId: string;
  branchId: string;
  medicineId: string;
  requiredQuantity: number;
  referenceModule: string;
  referenceId: string;
  performedBy: string;
  manualBatchId?: string | null;
  unitCost?: number;
}

export interface ConsumedBatch {
  batchId: string | null;
  quantityConsumed: number;
}

/**
 * Module 6 — THE authoritative owner of batch identity + expiry logic + FEFO.
 *
 * `isBatchSellable()` is the SINGLE enforcement point for the expired/recalled
 * hard-block (spec §11/§17): a batch that is expired, recalled or depleted is
 * NEVER selectable for sale — not through automatic FEFO, not through manual
 * override, not through a direct API call. Every quantity change here calls
 * Module 5's `InventoryService` in the same transaction, so this module's
 * `currentQuantity` never drifts from the ledger.
 */
@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly events: BatchEventsEmitter,
    private readonly audit: AuditLogService,
  ) {}

  private run<T>(tx: Prisma.TransactionClient | undefined, fn: (c: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return tx ? fn(tx) : this.prisma.$transaction(fn);
  }

  private resolveBranch(user: AuthenticatedUser, requested?: string): string {
    const branchId = requested ?? user.branchId;
    if (!user.accessibleBranchIds.includes(branchId)) {
      throw new ForbiddenException({ errorCode: 'BRANCH_ACCESS_DENIED', message: `No access to branch ${branchId}` });
    }
    return branchId;
  }

  /** Terminal/live classification. Recall + depletion win over expiry ordering. */
  computeStatus(batch: { isRecalled: boolean; currentQuantity: number; expiryDate: Date }, now = new Date()): BatchStatus {
    if (batch.isRecalled) return BatchStatus.RECALLED;
    if (batch.currentQuantity <= 0) return BatchStatus.DEPLETED;
    if (batch.expiryDate.getTime() <= now.getTime()) return BatchStatus.EXPIRED;
    const days = (batch.expiryDate.getTime() - now.getTime()) / 86400000;
    if (days <= EXPIRING_SOON_MAX) return BatchStatus.EXPIRING_SOON;
    return BatchStatus.FRESH;
  }

  private daysToExpiry(expiry: Date, now = new Date()): number {
    return Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
  }

  private tierOf(days: number): 'red' | 'orange' | 'yellow' | 'fresh' {
    if (days < TIER_RED) return 'red';
    if (days < TIER_ORANGE) return 'orange';
    if (days <= EXPIRING_SOON_MAX) return 'yellow';
    return 'fresh';
  }

  // =========================================================================
  // CONTRACT (called server-to-server by Modules 3 & 4)
  // =========================================================================

  /**
   * Module 3 (GRN) origin. Same medicine + batchNumber + branch APPENDS; a new
   * number CREATES. Records the stock IN through Module 5 in the same tx.
   */
  async createOrAppendBatch(params: CreateOrAppendBatchParams, tx?: Prisma.TransactionClient) {
    const expiry = new Date(params.expiryDate);
    const now = new Date();
    if (isNaN(expiry.getTime())) throw new BadRequestException({ errorCode: 'INVALID_EXPIRY', message: 'Invalid expiry date.' });
    if (expiry.getTime() <= now.getTime() && !(params.expiryOverridden && params.expiryOverrideReason?.trim())) {
      throw new BadRequestException({ errorCode: 'EXPIRED_STOCK', message: `Batch ${params.batchNumber} is expired. An override reason is required to receive it.` });
    }
    if (params.quantity <= 0) throw new BadRequestException({ errorCode: 'INVALID_QUANTITY', message: 'Quantity must be greater than zero.' });

    const { batch, appended } = await this.run(tx, async (c) => {
      const existing = await c.medicineBatch.findFirst({
        where: { pharmacyId: params.pharmacyId, branchId: params.branchId, medicineId: params.medicineId, batchNumber: params.batchNumber },
      });
      let row;
      let wasAppend = false;
      if (existing) {
        wasAppend = true;
        const nextQty = existing.currentQuantity + params.quantity;
        row = await c.medicineBatch.update({
          where: { id: existing.id },
          data: {
            receivedQuantity: existing.receivedQuantity + params.quantity,
            currentQuantity: nextQty,
            status: this.computeStatus({ isRecalled: existing.isRecalled, currentQuantity: nextQty, expiryDate: existing.expiryDate }, now),
          },
        });
      } else {
        row = await c.medicineBatch.create({
          data: {
            pharmacyId: params.pharmacyId,
            branchId: params.branchId,
            medicineId: params.medicineId,
            batchNumber: params.batchNumber,
            manufactureDate: params.manufactureDate ? new Date(params.manufactureDate) : null,
            expiryDate: expiry,
            receivedQuantity: params.quantity,
            currentQuantity: params.quantity,
            unitCostAtReceipt: params.unitCost,
            status: this.computeStatus({ isRecalled: false, currentQuantity: params.quantity, expiryDate: expiry }, now),
            expiryOverridden: params.expiryOverridden ?? false,
            expiryOverrideReason: params.expiryOverrideReason ?? null,
            sourceGrnId: params.sourceGrnId ?? null,
            sourceGrnItemId: params.sourceGrnItemId ?? null,
          },
        });
      }
      // Stock IN through Module 5 — enrolled in the caller's tx (all-or-nothing).
      await this.inventory.recordStockIn(
        {
          pharmacyId: params.pharmacyId,
          branchId: params.branchId,
          medicineId: params.medicineId,
          batchId: row.id,
          quantity: params.quantity,
          unitCost: params.unitCost,
          reasonCode: 'PURCHASE_RECEIPT',
          referenceModule: params.referenceModule ?? 'PURCHASE',
          referenceId: params.referenceId ?? row.id,
          performedBy: params.performedBy,
        },
        c,
      );
      return { batch: row, appended: wasAppend };
    });

    await this.audit.record({
      pharmacyId: params.pharmacyId,
      branchId: params.branchId,
      userId: params.performedBy,
      action: appended ? 'BATCH_APPENDED' : 'BATCH_CREATED',
      entityType: 'MEDICINE_BATCH',
      entityId: batch.id,
      metadata: { batchNumber: batch.batchNumber, quantity: params.quantity, expiryDate: expiry.toISOString() },
    });
    this.events.created({ pharmacyId: params.pharmacyId, branchId: params.branchId, batchId: batch.id, medicineId: params.medicineId });
    return batch;
  }

  /** Non-mutating FEFO preview: the ordered draw plan for a required quantity. */
  async getFefoAllocation(params: { pharmacyId: string; branchId: string; medicineId: string; requiredQuantity: number }): Promise<FefoAllocationLine[]> {
    if (params.requiredQuantity <= 0) return [];
    const batches = await this.sellableBatches(this.prisma, params.pharmacyId, params.branchId, params.medicineId);
    const plan: FefoAllocationLine[] = [];
    let remaining = params.requiredQuantity;
    for (const b of batches) {
      if (remaining <= 0) break;
      const take = Math.min(b.currentQuantity, remaining);
      plan.push({ batchId: b.id, batchNumber: b.batchNumber, expiryDate: b.expiryDate.toISOString(), quantityFromBatch: take });
      remaining -= take;
    }
    return plan;
  }

  /** The soonest sellable batch per medicine — POS cart-line "will draw from" tag. */
  async previewFefoBatches(pharmacyId: string, branchId: string, medicineIds: string[]): Promise<Map<string, { batchNumber: string; expiryDate: string }>> {
    const now = new Date();
    const rows = await this.prisma.medicineBatch.findMany({
      where: { pharmacyId, branchId, medicineId: { in: medicineIds }, currentQuantity: { gt: 0 }, isRecalled: false, expiryDate: { gt: now } },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
      select: { medicineId: true, batchNumber: true, expiryDate: true },
    });
    const out = new Map<string, { batchNumber: string; expiryDate: string }>();
    for (const r of rows) if (!out.has(r.medicineId)) out.set(r.medicineId, { batchNumber: r.batchNumber, expiryDate: r.expiryDate.toISOString() });
    return out;
  }

  /** Sellable = quantity > 0, not recalled, not expired. Ordered FEFO + deterministic. */
  private async sellableBatches(c: Prisma.TransactionClient | PrismaService, pharmacyId: string, branchId: string, medicineId: string) {
    const now = new Date();
    return c.medicineBatch.findMany({
      where: { pharmacyId, branchId, medicineId, currentQuantity: { gt: 0 }, isRecalled: false, expiryDate: { gt: now } },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * FEFO decision + Module 5 stock OUT in one transaction — the sole path a sale
   * consumes stock. Expired/recalled batches are excluded here at the service
   * layer, so no manual override or direct call can dispense them (spec §11).
   */
  async allocateAndConsume(params: AllocateAndConsumeParams, tx?: Prisma.TransactionClient): Promise<ConsumedBatch[]> {
    if (params.requiredQuantity <= 0) throw new BadRequestException({ errorCode: 'INVALID_QUANTITY', message: 'Quantity must be greater than zero.' });

    return this.run(tx, async (c) => {
      // Serialize concurrent consumption of this medicine's batches on the
      // Medicine row (Module 5 also locks it in recordStockOut).
      await c.$queryRaw`SELECT id FROM "Medicine" WHERE id = ${params.medicineId} FOR UPDATE`;

      const totalBatches = await c.medicineBatch.count({ where: { pharmacyId: params.pharmacyId, branchId: params.branchId, medicineId: params.medicineId } });

      // Non-batch-tracked medicine (never had a batch) → direct Module 5 path (spec §21).
      if (totalBatches === 0) {
        await this.inventory.recordStockOut(
          { pharmacyId: params.pharmacyId, branchId: params.branchId, medicineId: params.medicineId, batchId: null, quantity: params.requiredQuantity, unitCost: params.unitCost, reasonCode: 'SALE', referenceModule: params.referenceModule, referenceId: params.referenceId, performedBy: params.performedBy },
          c,
        );
        return [{ batchId: null, quantityConsumed: params.requiredQuantity }];
      }

      let sellable = await this.sellableBatches(c, params.pharmacyId, params.branchId, params.medicineId);

      // Manual override: must resolve to a *sellable* batch, else hard-reject —
      // an expired/recalled batch can never be forced (spec §2.2/§11).
      if (params.manualBatchId) {
        const chosen = sellable.find((b) => b.id === params.manualBatchId);
        if (!chosen) {
          const raw = await c.medicineBatch.findUnique({ where: { id: params.manualBatchId } });
          const why = !raw ? 'not found' : raw.isRecalled ? 'recalled' : raw.expiryDate.getTime() <= Date.now() ? 'expired' : raw.currentQuantity <= 0 ? 'depleted' : 'not available in this branch';
          throw new BadRequestException({ errorCode: 'MANUAL_BATCH_NOT_SELLABLE', message: `The selected batch cannot be dispensed (${why}).` });
        }
        sellable = [chosen, ...sellable.filter((b) => b.id !== params.manualBatchId)];
      }

      const available = sellable.reduce((s, b) => s + b.currentQuantity, 0);
      if (available < params.requiredQuantity) {
        throw new BadRequestException({ errorCode: 'INSUFFICIENT_SELLABLE_STOCK', message: `Only ${available} unit(s) available for sale (expired/recalled stock excluded).`, data: { available } });
      }

      const consumed: ConsumedBatch[] = [];
      let remaining = params.requiredQuantity;
      const now = new Date();
      for (const b of sellable) {
        if (remaining <= 0) break;
        const take = Math.min(b.currentQuantity, remaining);
        const nextQty = b.currentQuantity - take;
        await c.medicineBatch.update({
          where: { id: b.id },
          data: { currentQuantity: nextQty, status: this.computeStatus({ isRecalled: b.isRecalled, currentQuantity: nextQty, expiryDate: b.expiryDate }, now) },
        });
        await this.inventory.recordStockOut(
          { pharmacyId: params.pharmacyId, branchId: params.branchId, medicineId: params.medicineId, batchId: b.id, quantity: take, unitCost: params.unitCost, reasonCode: 'SALE', referenceModule: params.referenceModule, referenceId: params.referenceId, performedBy: params.performedBy },
          c,
        );
        consumed.push({ batchId: b.id, quantityConsumed: take });
        remaining -= take;
      }
      return consumed;
    });
  }

  /** Reverse a consumption (sale void): restore batch qty + Module 5 stock IN. */
  async reverseConsumption(
    params: { pharmacyId: string; branchId: string; items: Array<{ medicineId: string; batchId: string | null; quantity: number }>; referenceModule: string; referenceId: string; performedBy: string; notes?: string },
    tx?: Prisma.TransactionClient,
  ) {
    return this.run(tx, async (c) => {
      const now = new Date();
      for (const it of params.items) {
        if (it.batchId) {
          const b = await c.medicineBatch.findUnique({ where: { id: it.batchId } });
          if (b) {
            const nextQty = b.currentQuantity + it.quantity;
            await c.medicineBatch.update({
              where: { id: b.id },
              data: { currentQuantity: nextQty, status: this.computeStatus({ isRecalled: b.isRecalled, currentQuantity: nextQty, expiryDate: b.expiryDate }, now) },
            });
          }
        }
        await this.inventory.recordStockIn(
          { pharmacyId: params.pharmacyId, branchId: params.branchId, medicineId: it.medicineId, batchId: it.batchId, quantity: it.quantity, reasonCode: 'POSITIVE_ADJUSTMENT', referenceModule: params.referenceModule, referenceId: params.referenceId, performedBy: params.performedBy, notes: params.notes },
          c,
        );
      }
    });
  }

  /** Single enforcement point for the expired/recalled/depleted hard-block. */
  async isBatchSellable(params: { batchId: string }): Promise<boolean> {
    const b = await this.prisma.medicineBatch.findUnique({ where: { id: params.batchId } });
    if (!b) return false;
    return b.currentQuantity > 0 && !b.isRecalled && b.expiryDate.getTime() > Date.now();
  }

  // =========================================================================
  // HTTP reads
  // =========================================================================

  async list(user: AuthenticatedUser, q: QueryBatchesDto) {
    const branchId = this.resolveBranch(user, q.branchId);
    const page = q.page ? Number(q.page) : 1;
    const limit = q.limit ? Number(q.limit) : 25;
    const where: Prisma.MedicineBatchWhereInput = { pharmacyId: user.pharmacyId, branchId };
    if (q.medicineId) where.medicineId = q.medicineId;
    if (q.status) where.status = q.status as BatchStatus;
    if (q.expiryFrom || q.expiryTo) where.expiryDate = { ...(q.expiryFrom ? { gte: new Date(q.expiryFrom) } : {}), ...(q.expiryTo ? { lte: new Date(q.expiryTo) } : {}) };
    if (q.search?.trim()) {
      const term = q.search.trim();
      const meds = await this.prisma.medicine.findMany({ where: { pharmacyId: user.pharmacyId, OR: [{ brandName: { contains: term, mode: 'insensitive' } }, { genericName: { contains: term, mode: 'insensitive' } }] }, select: { id: true } });
      where.OR = [{ batchNumber: { contains: term, mode: 'insensitive' } }, { medicineId: { in: meds.map((m) => m.id) } }];
    }
    const sortBy = ['expiryDate', 'createdAt', 'currentQuantity'].includes(q.sortBy ?? '') ? q.sortBy! : 'expiryDate';
    const sortOrder = q.sortOrder === 'desc' ? 'desc' : 'asc';

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.medicineBatch.count({ where }),
      this.prisma.medicineBatch.findMany({ where, orderBy: { [sortBy]: sortOrder }, skip: (page - 1) * limit, take: limit }),
    ]);
    const names = await this.medicineNames(user.pharmacyId, rows.map((r) => r.medicineId));
    const now = new Date();
    return {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      data: rows.map((b) => this.toListRow(b, names, now)),
    };
  }

  async detail(user: AuthenticatedUser, id: string) {
    const b = await this.prisma.medicineBatch.findFirst({ where: { id, pharmacyId: user.pharmacyId }, include: { writeOffs: { orderBy: { writtenOffAt: 'desc' } }, recallRecords: { orderBy: { flaggedAt: 'desc' } } } });
    if (!b) throw new NotFoundException({ errorCode: 'BATCH_NOT_FOUND', message: 'Batch not found' });
    const names = await this.medicineNames(user.pharmacyId, [b.medicineId]);
    // Traceability: sales that consumed from this batch (via SaleItem.batchId).
    const saleItems = await this.prisma.saleItem.findMany({ where: { batchId: b.id }, include: { sale: { select: { id: true, saleNumber: true, saleDate: true, status: true } } }, orderBy: { sale: { saleDate: 'desc' } }, take: 100 });
    const now = new Date();
    return {
      ...this.toListRow(b, names, now),
      receivedQuantity: b.receivedQuantity,
      unitCostAtReceipt: dec(b.unitCostAtReceipt),
      manufactureDate: b.manufactureDate?.toISOString() ?? null,
      expiryOverridden: b.expiryOverridden,
      expiryOverrideReason: b.expiryOverrideReason,
      sourceGrnId: b.sourceGrnId,
      createdAt: b.createdAt.toISOString(),
      linkedSales: saleItems.map((si) => ({ saleId: si.sale.id, saleNumber: si.sale.saleNumber, saleDate: si.sale.saleDate.toISOString(), status: si.sale.status, quantity: si.quantity })),
      writeOffs: b.writeOffs.map((w) => ({ id: w.id, quantity: w.quantityWrittenOff, disposalMethod: w.disposalMethod, disposalReference: w.disposalReference, writtenOffBy: w.writtenOffBy, writtenOffAt: w.writtenOffAt.toISOString(), notes: w.notes })),
      recalls: b.recallRecords.map((r) => ({ id: r.id, reason: r.reason, sourceReference: r.sourceReference, resolutionStatus: r.resolutionStatus, flaggedAt: r.flaggedAt.toISOString(), resolvedAt: r.resolvedAt?.toISOString() ?? null })),
    };
  }

  async expiring(user: AuthenticatedUser, thresholdDays?: number, branchId?: string) {
    const scope = this.resolveBranch(user, branchId);
    const days = thresholdDays && thresholdDays > 0 ? thresholdDays : EXPIRING_SOON_MAX;
    const now = new Date();
    const limit = new Date(now.getTime() + days * 86400000);
    const rows = await this.prisma.medicineBatch.findMany({
      where: { pharmacyId: user.pharmacyId, branchId: scope, currentQuantity: { gt: 0 }, isRecalled: false, expiryDate: { gt: now, lte: limit } },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    });
    const names = await this.medicineNames(user.pharmacyId, rows.map((r) => r.medicineId));
    const items = rows.map((b) => this.toListRow(b, names, now));
    return {
      thresholdDays: days,
      counts: { red: items.filter((i) => i.tier === 'red').length, orange: items.filter((i) => i.tier === 'orange').length, yellow: items.filter((i) => i.tier === 'yellow').length },
      items,
    };
  }

  async expired(user: AuthenticatedUser, branchId?: string) {
    const scope = this.resolveBranch(user, branchId);
    const now = new Date();
    const rows = await this.prisma.medicineBatch.findMany({
      where: { pharmacyId: user.pharmacyId, branchId: scope, currentQuantity: { gt: 0 }, expiryDate: { lte: now } },
      orderBy: { expiryDate: 'asc' },
    });
    const names = await this.medicineNames(user.pharmacyId, rows.map((r) => r.medicineId));
    return rows.map((b) => this.toListRow(b, names, now));
  }

  // -------------------------------------------------------------------------
  private toListRow(b: { id: string; medicineId: string; batchNumber: string; expiryDate: Date; currentQuantity: number; status: BatchStatus; isRecalled: boolean; branchId: string; createdAt: Date }, names: Map<string, string>, now: Date) {
    const days = this.daysToExpiry(b.expiryDate, now);
    // Re-derive live status on read so expiry crossings show immediately, without
    // waiting for the nightly refresh (persisted status is for fast filtering).
    const liveStatus = this.computeStatus({ isRecalled: b.isRecalled, currentQuantity: b.currentQuantity, expiryDate: b.expiryDate }, now);
    return {
      id: b.id,
      medicineId: b.medicineId,
      medicineName: names.get(b.medicineId) ?? b.medicineId,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate.toISOString(),
      daysToExpiry: days,
      currentQuantity: b.currentQuantity,
      status: liveStatus,
      isRecalled: b.isRecalled,
      tier: this.tierOf(days),
      branchId: b.branchId,
      receivedDate: b.createdAt.toISOString(),
    };
  }

  private async medicineNames(pharmacyId: string, ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const meds = await this.prisma.medicine.findMany({ where: { pharmacyId, id: { in: [...new Set(ids)] } }, select: { id: true, brandName: true, genericName: true } });
    return new Map(meds.map((m) => [m.id, m.brandName ?? m.genericName]));
  }
}
