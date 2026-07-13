import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockAdjustment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { SettingsService } from '../settings/settings.service';
import { StockAdjustmentsRepository } from './stock-adjustments.repository';
import { InventoryAdjustmentService } from './integrations/inventory-adjustment.service';
import { StockAdjustmentEventsEmitter } from './events/stock-adjustment-events.emitter';
import { BulkCreateAdjustmentDto, CreateAdjustmentDto, QueryAdjustmentsDto } from './dto/stock-adjustment.dto';
import { isAutoApproved } from './adjustment-threshold';

const dec = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : typeof v === 'number' ? v : v.toNumber());

@Injectable()
export class StockAdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: StockAdjustmentsRepository,
    private readonly inventoryAdjust: InventoryAdjustmentService,
    private readonly settings: SettingsService,
    private readonly events: StockAdjustmentEventsEmitter,
    private readonly audit: AuditLogService,
  ) {}

  private resolveBranch(user: AuthenticatedUser, requested?: string): string {
    const branchId = requested ?? user.branchId;
    if (!user.accessibleBranchIds.includes(branchId)) {
      throw new ForbiddenException({ errorCode: 'BRANCH_ACCESS_DENIED', message: `You do not have access to branch ${branchId}` });
    }
    return branchId;
  }

  private async thresholds(pharmacyId: string, branchId: string) {
    const cfg = await this.settings.getMany(['adjustments.autoApproveMaxQuantity', 'adjustments.autoApproveMaxValue'], { pharmacyId, branchId });
    return { maxQty: Number(cfg['adjustments.autoApproveMaxQuantity'] ?? 10), maxValue: Number(cfg['adjustments.autoApproveMaxValue'] ?? 5000) };
  }

  // --- Create --------------------------------------------------------------
  async create(user: AuthenticatedUser, dto: CreateAdjustmentDto) {
    const branchId = this.resolveBranch(user, dto.branchId);
    const prepared = await this.prepare(user, dto, branchId);
    return this.persist(user, branchId, [prepared]).then((r) => r[0].adjustment && this.serialize(r[0].adjustment!));
  }

  async bulkCreate(user: AuthenticatedUser, dto: BulkCreateAdjustmentDto) {
    // Validate every line first (partial-validation UX): report per-line errors
    // instead of failing the whole batch opaquely (spec §10).
    const branchIdDefault = this.resolveBranch(user, undefined);
    const prepared = await Promise.all(
      dto.items.map(async (item, index) => {
        try {
          const branchId = this.resolveBranch(user, item.branchId);
          return { index, ok: true as const, branchId, data: await this.prepare(user, item, branchId) };
        } catch (e) {
          return { index, ok: false as const, error: e instanceof Error ? (e as { response?: { message?: string } }).response?.message ?? e.message : 'Invalid line' };
        }
      }),
    );

    const results: Array<{ index: number; success: boolean; adjustmentNumber?: string; status?: string; error?: string }> = [];
    for (const p of prepared) {
      if (!p.ok) {
        results.push({ index: p.index, success: false, error: p.error });
        continue;
      }
      try {
        const [saved] = await this.persist(user, p.branchId, [p.data]);
        results.push({ index: p.index, success: true, adjustmentNumber: saved.adjustment!.adjustmentNumber, status: saved.adjustment!.status });
      } catch (e) {
        results.push({ index: p.index, success: false, error: e instanceof Error ? (e as { response?: { message?: string } }).response?.message ?? e.message : 'Failed' });
      }
    }
    return { total: dto.items.length, succeeded: results.filter((r) => r.success).length, failed: results.filter((r) => !r.success).length, results };
  }

  /** Validate + resolve everything needed to create one adjustment (no writes). */
  private async prepare(user: AuthenticatedUser, dto: CreateAdjustmentDto, branchId: string) {
    if (dto.reasonCode === 'OTHER' && !dto.reasonNote?.trim()) {
      throw new BadRequestException({ errorCode: 'REASON_NOTE_REQUIRED', message: 'A reason note is required when the reason code is OTHER.' });
    }
    const med = await this.prisma.medicine.findFirst({ where: { id: dto.medicineId, pharmacyId: user.pharmacyId }, select: { id: true, costPrice: true, genericName: true, brandName: true } });
    if (!med) throw new BadRequestException({ errorCode: 'INVALID_MEDICINE', message: 'Medicine not found.' });

    if (dto.linkedReconciliationId) {
      const rec = await this.prisma.stockReconciliation.findFirst({ where: { id: dto.linkedReconciliationId, pharmacyId: user.pharmacyId } });
      if (!rec) throw new BadRequestException({ errorCode: 'INVALID_RECONCILIATION', message: 'Linked reconciliation not found.' });
      if (rec.resolvedByAdjustmentId) throw new BadRequestException({ errorCode: 'RECONCILIATION_RESOLVED', message: 'This reconciliation has already been resolved by another adjustment.' });
    }

    const unitCost = dec(med.costPrice);
    const value = unitCost * dto.quantity;
    const { maxQty, maxValue } = await this.thresholds(user.pharmacyId, branchId);
    const autoApprove = isAutoApproved(dto.quantity, value, maxQty, maxValue);
    return { dto, unitCost, value, autoApprove, medName: med.brandName ?? med.genericName };
  }

  /** Persist prepared adjustments; auto-approved ones execute stock in the same tx. */
  private async persist(user: AuthenticatedUser, branchId: string, prepared: Array<Awaited<ReturnType<StockAdjustmentsService['prepare']>>>) {
    const out: Array<{ adjustment: StockAdjustment | null }> = [];
    for (const p of prepared) {
      const adjustment = await this.prisma.$transaction(async (tx) => {
        const adjustmentNumber = await this.repo.nextNumber(tx, user.pharmacyId);
        const created = await tx.stockAdjustment.create({
          data: {
            pharmacyId: user.pharmacyId,
            branchId,
            adjustmentNumber,
            medicineId: p.dto.medicineId,
            batchId: p.dto.batchId ?? null,
            direction: p.dto.direction,
            quantity: p.dto.quantity,
            unitCostAtRequest: p.unitCost,
            reasonCode: p.dto.reasonCode,
            reasonNote: p.dto.reasonNote,
            evidenceUrl: p.dto.evidenceUrl,
            linkedReconciliationId: p.dto.linkedReconciliationId ?? null,
            status: p.autoApprove ? 'AUTO_APPROVED' : 'PENDING_APPROVAL',
            requestedBy: user.userId,
            ...(p.autoApprove ? { approvedBy: user.userId, approvedAt: new Date() } : {}),
          },
        });
        // Auto-approved → execute the stock effect NOW, in this same transaction.
        if (p.autoApprove) await this.inventoryAdjust.execute(tx, created);
        return created;
      });

      await this.audit.record({
        pharmacyId: user.pharmacyId, branchId, userId: user.userId,
        action: 'ADJUSTMENT_CREATED', entityType: 'STOCK_ADJUSTMENT', entityId: adjustment.id,
        metadata: { adjustmentNumber: adjustment.adjustmentNumber, medicine: p.medName, quantity: p.dto.quantity, direction: p.dto.direction, reasonCode: p.dto.reasonCode, autoApproved: p.autoApprove },
      });
      if (p.autoApprove) {
        await this.audit.record({ pharmacyId: user.pharmacyId, branchId, userId: user.userId, action: 'ADJUSTMENT_AUTO_APPROVED', entityType: 'STOCK_ADJUSTMENT', entityId: adjustment.id, metadata: { adjustmentNumber: adjustment.adjustmentNumber } });
      }
      this.events.created({ pharmacyId: user.pharmacyId, branchId, adjustmentId: adjustment.id, medicineId: p.dto.medicineId, actorId: user.userId });
      out.push({ adjustment });
    }
    return out;
  }

  // --- Approve / Reject ----------------------------------------------------
  async approve(user: AuthenticatedUser, id: string) {
    const adj = await this.repo.findById(user.pharmacyId, id);
    if (!adj) throw new NotFoundException({ errorCode: 'ADJUSTMENT_NOT_FOUND', message: 'Adjustment not found' });
    if (adj.status !== 'PENDING_APPROVAL') throw new BadRequestException({ errorCode: 'NOT_PENDING', message: `Adjustment is ${adj.status}, not pending approval.` });

    // Two-person rule: the approver must not be the requester — even a valid admin.
    if (adj.requestedBy === user.userId) {
      await this.audit.record({
        pharmacyId: user.pharmacyId, branchId: adj.branchId, userId: user.userId,
        action: 'SELF_APPROVAL_ATTEMPT_BLOCKED', entityType: 'STOCK_ADJUSTMENT', entityId: adj.id,
        metadata: { adjustmentNumber: adj.adjustmentNumber },
      });
      throw new ForbiddenException({ errorCode: 'SELF_APPROVAL_FORBIDDEN', message: 'You cannot approve your own adjustment request. A different admin must review it.' });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.stockAdjustment.findUnique({ where: { id } });
      if (!fresh || fresh.status !== 'PENDING_APPROVAL') throw new BadRequestException({ errorCode: 'NOT_PENDING', message: 'Adjustment is no longer pending.' });
      const row = await tx.stockAdjustment.update({ where: { id }, data: { status: 'APPROVED', approvedBy: user.userId, approvedAt: new Date() } });
      // Execute the deferred stock effect atomically — recordStockOut re-validates
      // current stock here (stale-delta / over-decrement safety).
      await this.inventoryAdjust.execute(tx, row);
      return row;
    });

    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: adj.branchId, userId: user.userId, action: 'ADJUSTMENT_APPROVED', entityType: 'STOCK_ADJUSTMENT', entityId: adj.id, metadata: { adjustmentNumber: adj.adjustmentNumber, requestedBy: adj.requestedBy } });
    this.events.approved({ pharmacyId: user.pharmacyId, branchId: adj.branchId, adjustmentId: adj.id, medicineId: adj.medicineId, actorId: user.userId });
    return this.serialize(updated);
  }

  async reject(user: AuthenticatedUser, id: string, reason: string) {
    const adj = await this.repo.findById(user.pharmacyId, id);
    if (!adj) throw new NotFoundException({ errorCode: 'ADJUSTMENT_NOT_FOUND', message: 'Adjustment not found' });
    if (adj.status !== 'PENDING_APPROVAL') throw new BadRequestException({ errorCode: 'NOT_PENDING', message: `Adjustment is ${adj.status}, not pending approval.` });
    const updated = await this.prisma.stockAdjustment.update({ where: { id }, data: { status: 'REJECTED', rejectedReason: reason, approvedBy: user.userId, approvedAt: new Date() } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: adj.branchId, userId: user.userId, action: 'ADJUSTMENT_REJECTED', entityType: 'STOCK_ADJUSTMENT', entityId: adj.id, metadata: { adjustmentNumber: adj.adjustmentNumber, reason } });
    this.events.rejected({ pharmacyId: user.pharmacyId, branchId: adj.branchId, adjustmentId: adj.id, medicineId: adj.medicineId, actorId: user.userId });
    return this.serialize(updated);
  }

  // --- Queries -------------------------------------------------------------
  async list(user: AuthenticatedUser, q: QueryAdjustmentsDto) {
    const { total, rows, page, limit } = await this.repo.list(user.pharmacyId, q);
    const data = await this.withNames(rows);
    return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), data };
  }

  async pending(user: AuthenticatedUser) {
    const rows = await this.repo.pending(user.pharmacyId);
    return this.withNames(rows);
  }

  async detail(user: AuthenticatedUser, id: string) {
    const adj = await this.repo.findById(user.pharmacyId, id);
    if (!adj) throw new NotFoundException({ errorCode: 'ADJUSTMENT_NOT_FOUND', message: 'Adjustment not found' });
    const [named] = await this.withNames([adj]);
    let reconciliation = null;
    if (adj.linkedReconciliationId) {
      const rec = await this.prisma.stockReconciliation.findFirst({ where: { id: adj.linkedReconciliationId, pharmacyId: user.pharmacyId } });
      if (rec) reconciliation = { id: rec.id, expectedQuantity: rec.expectedQuantity, countedQuantity: rec.countedQuantity, variance: rec.variance, countedAt: rec.countedAt.toISOString() };
    }
    return { ...named, reconciliation };
  }

  async shrinkageReport(user: AuthenticatedUser, dateFrom?: string, dateTo?: string, branchId?: string) {
    const rows = await this.repo.shrinkage(user.pharmacyId, dateFrom, dateTo, branchId);
    const byReason = new Map<string, { quantity: number; value: number; count: number }>();
    const byMedicine = new Map<string, { quantity: number; value: number; count: number }>();
    const byRequester = new Map<string, { quantity: number; value: number; count: number }>();
    for (const r of rows) {
      const value = dec(r.unitCostAtRequest) * r.quantity;
      const add = (m: Map<string, { quantity: number; value: number; count: number }>, k: string) => {
        const cur = m.get(k) ?? { quantity: 0, value: 0, count: 0 };
        m.set(k, { quantity: cur.quantity + r.quantity, value: cur.value + value, count: cur.count + 1 });
      };
      add(byReason, r.reasonCode);
      add(byMedicine, r.medicineId);
      add(byRequester, r.requestedBy);
    }
    const medIds = [...byMedicine.keys()];
    const meds = await this.prisma.medicine.findMany({ where: { id: { in: medIds } }, select: { id: true, genericName: true, brandName: true } });
    const nameOf = new Map(meds.map((m) => [m.id, m.brandName ?? m.genericName]));
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const shape = (m: Map<string, { quantity: number; value: number; count: number }>, nameFn?: (k: string) => string) =>
      [...m.entries()].map(([key, v]) => ({ key: nameFn ? nameFn(key) : key, id: key, quantity: v.quantity, value: round2(v.value), count: v.count })).sort((a, b) => b.value - a.value);
    return {
      totalNegativeQuantity: rows.reduce((s, r) => s + r.quantity, 0),
      totalValue: round2(rows.reduce((s, r) => s + dec(r.unitCostAtRequest) * r.quantity, 0)),
      byReason: shape(byReason),
      byMedicine: shape(byMedicine, (id) => nameOf.get(id) ?? id),
      byRequester: shape(byRequester),
    };
  }

  private async withNames(rows: StockAdjustment[]) {
    const medIds = [...new Set(rows.map((r) => r.medicineId))];
    const meds = medIds.length ? await this.prisma.medicine.findMany({ where: { id: { in: medIds } }, select: { id: true, genericName: true, brandName: true } }) : [];
    const nameOf = new Map(meds.map((m) => [m.id, m.brandName ?? m.genericName]));
    return rows.map((r) => ({ ...this.serialize(r), medicineName: nameOf.get(r.medicineId) ?? r.medicineId }));
  }

  private serialize(a: StockAdjustment) {
    return {
      id: a.id, adjustmentNumber: a.adjustmentNumber, medicineId: a.medicineId, batchId: a.batchId,
      direction: a.direction, quantity: a.quantity, unitCostAtRequest: dec(a.unitCostAtRequest), value: dec(a.unitCostAtRequest) * a.quantity,
      reasonCode: a.reasonCode, reasonNote: a.reasonNote, evidenceUrl: a.evidenceUrl, linkedReconciliationId: a.linkedReconciliationId,
      status: a.status, requestedBy: a.requestedBy, requestedAt: a.requestedAt.toISOString(),
      approvedBy: a.approvedBy, approvedAt: a.approvedAt?.toISOString() ?? null, rejectedReason: a.rejectedReason,
    };
  }
}
