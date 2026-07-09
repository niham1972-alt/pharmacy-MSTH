import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConditionAssessment, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { SalesReturnsRepository } from './sales-returns.repository';
import { SettingsService } from '../settings/settings.service';
import { InventoryRestoreService } from './integrations/inventory-restore.service';
import { SaleStatusSyncService } from './integrations/sale-status-sync.service';
import { BatchWriteoffTriggerService } from './integrations/batch-writeoff-trigger.service';
import { StoreCreditService } from './store-credit.service';
import { SalesReturnEventsEmitter } from './events/sales-return-events.emitter';
import { CreateReturnDto } from './dto/create-return.dto';
import { ListReturnsDto } from './dto/list-returns.dto';
import { EligibilityLine, EligibilityResult } from './interfaces/eligibility-result.interface';

const ELEVATED = ['admin', 'super_admin', 'pharmacist'];
const STEP_UP_MAX_AGE_MS = 15 * 60_000;

function dec(v: Prisma.Decimal | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : v.toNumber();
}
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Refund for a partial return: original snapshot price × returned qty, minus the
 *  line's discount proportionally, plus proportional tax — never current pricing. */
function refundForLine(item: { quantity: number; unitPrice: Prisma.Decimal; discountAmount: Prisma.Decimal; taxRatePercent: Prisma.Decimal }, returnQty: number): number {
  const propDiscount = round2(dec(item.discountAmount) * (returnQty / item.quantity));
  const net = dec(item.unitPrice) * returnQty - propDiscount;
  const tax = round2((net * dec(item.taxRatePercent)) / 100);
  return round2(net + tax);
}

@Injectable()
export class SalesReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: SalesReturnsRepository,
    private readonly audit: AuditLogService,
    private readonly settings: SettingsService,
    private readonly inventoryRestore: InventoryRestoreService,
    private readonly saleStatusSync: SaleStatusSyncService,
    private readonly writeoffTrigger: BatchWriteoffTriggerService,
    private readonly storeCredit: StoreCreditService,
    private readonly events: SalesReturnEventsEmitter,
  ) {}

  // =========================================================================
  // Eligibility (advisory pre-check — re-checked authoritatively at create time)
  // =========================================================================
  async checkEligibility(user: AuthenticatedUser, saleId: string): Promise<EligibilityResult> {
    const sale = await this.repo.saleWithItems(user.pharmacyId, saleId);
    if (!sale) throw new NotFoundException({ errorCode: 'SALE_NOT_FOUND', message: 'Sale not found' });

    const [windowDays, nonReturnableCats, allowPx] = await Promise.all([
      this.settings.get<number>('returns.eligibilityWindowDays', { pharmacyId: user.pharmacyId, branchId: user.branchId }),
      this.settings.get<string[]>('returns.nonReturnableCategories', { pharmacyId: user.pharmacyId, branchId: user.branchId }),
      this.settings.get<boolean>('returns.allowPrescriptionItemReturns', { pharmacyId: user.pharmacyId, branchId: user.branchId }),
    ]);
    const catSet = new Set((nonReturnableCats ?? []).map((c) => c.toLowerCase()));

    const returned = await this.repo.returnedQtyByLine(user.pharmacyId, saleId);
    const meds = await this.repo.medicinesWithCategory(user.pharmacyId, [...new Set(sale.items.map((i) => i.medicineId))]);
    const medMap = new Map(meds.map((m) => [m.id, m]));

    const ageDays = (Date.now() - sale.saleDate.getTime()) / 86_400_000;
    const withinWindow = ageDays <= (windowDays ?? 14);

    const lines: EligibilityLine[] = sale.items.map((it) => {
      const med = medMap.get(it.medicineId);
      const alreadyReturned = returned.get(it.id) ?? 0;
      const remaining = it.quantity - alreadyReturned;
      const controlled = !!med?.controlledSubstanceSchedule;
      const prescriptionRequired = !!med?.prescriptionRequired;
      let ineligibleReason: string | null = null;
      if (sale.status === 'VOIDED') ineligibleReason = 'This sale was voided.';
      else if (remaining <= 0) ineligibleReason = 'Already fully returned.';
      else if (!withinWindow) ineligibleReason = `Outside the ${windowDays}-day return window.`;
      else if (controlled) ineligibleReason = 'Controlled substance — not returnable per pharmacy policy.';
      else if (prescriptionRequired && !allowPx) ineligibleReason = 'Prescription item — not returnable per pharmacy policy.';
      else if (med && catSet.has((med.category?.name ?? '').toLowerCase())) ineligibleReason = `Category "${med.category?.name}" is non-returnable.`;
      return {
        saleItemId: it.id,
        medicineId: it.medicineId,
        name: med?.brandName ?? med?.genericName ?? it.medicineId,
        batchId: it.batchId,
        purchasedQuantity: it.quantity,
        alreadyReturnedQuantity: alreadyReturned,
        remainingQuantity: Math.max(0, remaining),
        unitPrice: dec(it.unitPrice),
        maxRefundForRemaining: remaining > 0 ? refundForLine(it, remaining) : 0,
        prescriptionRequired,
        controlled,
        eligible: ineligibleReason === null,
        ineligibleReason,
        requiresApproval: prescriptionRequired, // clinical items always need sign-off when returned
      };
    });

    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'RETURN_ELIGIBILITY_CHECKED', entityType: 'SALE', entityId: saleId, metadata: { saleNumber: sale.saleNumber, eligibleLines: lines.filter((l) => l.eligible).length } });

    return { saleId, saleNumber: sale.saleNumber, saleDate: sale.saleDate.toISOString(), status: sale.status, customerId: sale.customerId, withinWindow, windowDays: windowDays ?? 14, anyEligible: lines.some((l) => l.eligible), lines };
  }

  // =========================================================================
  // Create — the full transactional flow (spec §8)
  // =========================================================================
  async createReturn(user: AuthenticatedUser, dto: CreateReturnDto) {
    const sale = await this.repo.saleWithItems(user.pharmacyId, dto.originalSaleId);
    if (!sale) throw new NotFoundException({ errorCode: 'SALE_NOT_FOUND', message: 'Original sale not found' });
    if (sale.status === 'VOIDED') throw new BadRequestException({ errorCode: 'SALE_VOIDED', message: 'A voided sale cannot be returned.' });

    const branchId = user.branchId; // the branch physically handling the return (cross-branch allowed)
    const [windowDays, nonReturnableCats, allowPx, cashierCanProcess, approvalReasons] = await Promise.all([
      this.settings.get<number>('returns.eligibilityWindowDays', { pharmacyId: user.pharmacyId, branchId }),
      this.settings.get<string[]>('returns.nonReturnableCategories', { pharmacyId: user.pharmacyId, branchId }),
      this.settings.get<boolean>('returns.allowPrescriptionItemReturns', { pharmacyId: user.pharmacyId, branchId }),
      this.settings.get<boolean>('returns.cashierCanProcessResaleable', { pharmacyId: user.pharmacyId, branchId }),
      this.settings.get<string[]>('returns.approvalRequiredReasons', { pharmacyId: user.pharmacyId, branchId }),
    ]);
    const catSet = new Set((nonReturnableCats ?? []).map((c) => c.toLowerCase()));
    const approvalReasonSet = new Set(approvalReasons ?? []);

    const ageDays = (Date.now() - sale.saleDate.getTime()) / 86_400_000;
    if (ageDays > (windowDays ?? 14)) throw new BadRequestException({ errorCode: 'RETURN_WINDOW_EXPIRED', message: `This sale is outside the ${windowDays}-day return window.` });

    const meds = await this.repo.medicinesWithCategory(user.pharmacyId, [...new Set(sale.items.map((i) => i.medicineId))]);
    const medMap = new Map(meds.map((m) => [m.id, m]));
    const returnedMap = await this.repo.returnedQtyByLine(user.pharmacyId, dto.originalSaleId);
    const saleItemMap = new Map(sale.items.map((i) => [i.id, i]));

    // Per-line authoritative validation (non-returnable hard-block + over-return).
    const lineData = dto.items.map((line) => {
      const it = saleItemMap.get(line.originalSaleItemId);
      if (!it) throw new BadRequestException({ errorCode: 'SALE_ITEM_NOT_FOUND', message: 'A line does not belong to this sale.' });
      const med = medMap.get(it.medicineId);
      if (med?.controlledSubstanceSchedule) { void this.rejectNonReturnable(user, dto.originalSaleId, it.medicineId, 'controlled'); throw new BadRequestException({ errorCode: 'NON_RETURNABLE_CONTROLLED', message: `${med.brandName ?? med.genericName} is a controlled substance and cannot be returned per pharmacy policy.` }); }
      if (med?.prescriptionRequired && !allowPx) { void this.rejectNonReturnable(user, dto.originalSaleId, it.medicineId, 'prescription'); throw new BadRequestException({ errorCode: 'NON_RETURNABLE_PRESCRIPTION', message: `${med.brandName ?? med.genericName} is a prescription item and is not returnable per pharmacy policy.` }); }
      if (med && catSet.has((med.category?.name ?? '').toLowerCase())) { void this.rejectNonReturnable(user, dto.originalSaleId, it.medicineId, 'category'); throw new BadRequestException({ errorCode: 'NON_RETURNABLE_CATEGORY', message: `${med.brandName ?? med.genericName} belongs to a non-returnable category and cannot be returned.` }); }
      const remaining = it.quantity - (returnedMap.get(it.id) ?? 0);
      if (line.quantityReturned > remaining) throw new BadRequestException({ errorCode: 'OVER_RETURN', message: `Only ${remaining} unit(s) of ${med?.brandName ?? med?.genericName ?? 'this item'} remain returnable.`, data: { remaining } });
      return {
        originalSaleItemId: it.id,
        medicineId: it.medicineId,
        batchId: it.batchId,
        quantityReturned: line.quantityReturned,
        unitPriceAtSale: dec(it.unitPrice),
        refundAmountForLine: refundForLine(it, line.quantityReturned),
        conditionAssessment: line.conditionAssessment,
        reasonCode: line.reasonCode,
        reasonNote: line.reasonNote,
        conditionPhotoUrl: line.conditionPhotoUrl,
        prescriptionRequired: !!med?.prescriptionRequired,
      };
    });

    const totalRefund = round2(lineData.reduce((s, l) => s + l.refundAmountForLine, 0));

    // Store-credit is only meaningful against a registered customer.
    if (dto.refundMethod === 'STORE_CREDIT' && !sale.customerId) {
      throw new BadRequestException({ errorCode: 'STORE_CREDIT_REQUIRES_CUSTOMER', message: 'Store credit needs a registered customer. Use cash or card for a walk-in.' });
    }

    // Elevated-approval gate.
    const needsApproval = lineData.some((l) => l.prescriptionRequired) || dto.items.some((i) => approvalReasonSet.has(i.reasonCode)) || (user.role === 'cashier' && !cashierCanProcess);
    let approvedBy: string | undefined;
    if (needsApproval) {
      if (ELEVATED.includes(user.role)) approvedBy = user.userId; // the processor is authorised to approve
      else approvedBy = await this.consumeStepUp(user, dto.stepUpId);
    }

    // -----------------------------------------------------------------------
    // Atomic: create records → restore resaleable stock → status sync → refund
    // -----------------------------------------------------------------------
    const resaleable = lineData.filter((l) => l.conditionAssessment === ConditionAssessment.RESALEABLE);
    const notResaleable = lineData.filter((l) => l.conditionAssessment === ConditionAssessment.NOT_RESALEABLE);

    const { salesReturnId, returnNumber, fullyReturned, creditBalanceAfter } = await this.prisma.$transaction(async (tx) => {
      await this.repo.lockSale(tx, dto.originalSaleId);
      // Authoritative re-check against concurrent returns.
      const freshReturned = await this.repo.returnedQtyByLine(user.pharmacyId, dto.originalSaleId, tx);
      for (const l of lineData) {
        const it = saleItemMap.get(l.originalSaleItemId)!;
        const remaining = it.quantity - (freshReturned.get(it.id) ?? 0);
        if (l.quantityReturned > remaining) throw new BadRequestException({ errorCode: 'OVER_RETURN', message: `Only ${remaining} unit(s) remain returnable (changed since you started).`, data: { remaining } });
      }

      const number = await this.repo.nextReturnNumber(tx, user.pharmacyId);
      const sr = await this.repo.create(tx, {
        pharmacyId: user.pharmacyId, branchId, returnNumber: number, originalSaleId: dto.originalSaleId, customerId: sale.customerId,
        processedBy: user.userId, approvedBy, totalRefundAmount: totalRefund, refundMethod: dto.refundMethod, refundReference: dto.refundReference, exchangeSaleId: dto.exchangeSaleId, notes: dto.notes,
      });

      // Restore only RESALEABLE units — into the original batch when still valid.
      // `outcomes` come back in the same order as `resaleable` (which preserves
      // lineData order), so a single counter aligns each outcome to its line.
      const outcomes = await this.inventoryRestore.restore(tx, { pharmacyId: user.pharmacyId, branchId, salesReturnId: sr.id, performedBy: user.userId, items: resaleable.map((l) => ({ medicineId: l.medicineId, batchId: l.batchId, quantity: l.quantityReturned })) });

      let ri = 0;
      for (const l of lineData) {
        const isResaleable = l.conditionAssessment === ConditionAssessment.RESALEABLE;
        const outcome = isResaleable ? outcomes[ri++] : undefined;
        await tx.salesReturnItem.create({
          data: {
            salesReturnId: sr.id, originalSaleItemId: l.originalSaleItemId, medicineId: l.medicineId, batchId: l.batchId,
            quantityReturned: l.quantityReturned, unitPriceAtSale: l.unitPriceAtSale, refundAmountForLine: l.refundAmountForLine,
            conditionAssessment: l.conditionAssessment, reasonCode: l.reasonCode, reasonNote: l.reasonNote, conditionPhotoUrl: l.conditionPhotoUrl,
            restoredToStock: isResaleable, flaggedForReview: outcome?.flaggedForReview ?? false,
          },
        });
      }

      // Store credit adjusts the balance inside the same transaction.
      let balanceAfter: number | undefined;
      if (dto.refundMethod === 'STORE_CREDIT' && sale.customerId) {
        balanceAfter = await this.storeCredit.issue(tx, { pharmacyId: user.pharmacyId, customerId: sale.customerId, amount: totalRefund, referenceId: sr.id, performedBy: user.userId });
      }

      // Original sale status transition (via Module 4's own method).
      const fully = sale.items.every((it) => (freshReturned.get(it.id) ?? 0) + (lineData.find((l) => l.originalSaleItemId === it.id)?.quantityReturned ?? 0) >= it.quantity);
      await this.saleStatusSync.sync(tx, user.pharmacyId, dto.originalSaleId, fully);

      return { salesReturnId: sr.id, returnNumber: number, fullyReturned: fully, creditBalanceAfter: balanceAfter };
    });

    // Post-commit side effects (fail-safe, non-transactional — same discipline as M4).
    if (notResaleable.length) {
      await this.writeoffTrigger.quarantine({ pharmacyId: user.pharmacyId, branchId, salesReturnId, performedBy: user.userId, items: notResaleable.map((l) => ({ medicineId: l.medicineId, batchId: l.batchId, quantity: l.quantityReturned })) });
    }
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId, userId: user.userId, action: 'RETURN_CREATED', entityType: 'SALES_RETURN', entityId: salesReturnId, severity: 'SENSITIVE', metadata: { returnNumber, originalSaleId: dto.originalSaleId, saleNumber: sale.saleNumber, totalRefundAmount: totalRefund, refundMethod: dto.refundMethod, itemCount: lineData.length, fullyReturned } });
    if (approvedBy && approvedBy !== user.userId) {
      await this.audit.record({ pharmacyId: user.pharmacyId, branchId, userId: user.userId, action: 'RETURN_APPROVAL_GRANTED', entityType: 'SALES_RETURN', entityId: salesReturnId, severity: 'SENSITIVE', metadata: { approver: approvedBy, returnNumber } });
    }
    if (dto.refundMethod === 'STORE_CREDIT' && sale.customerId) {
      await this.audit.record({ pharmacyId: user.pharmacyId, branchId, userId: user.userId, action: 'STORE_CREDIT_ISSUED', entityType: 'SALES_RETURN', entityId: salesReturnId, severity: 'SENSITIVE', metadata: { customerId: sale.customerId, amount: totalRefund, balanceAfter: creditBalanceAfter } });
      this.events.storeCreditIssued({ pharmacyId: user.pharmacyId, customerId: sale.customerId, amount: totalRefund, balanceAfter: creditBalanceAfter ?? 0, salesReturnId });
    }
    this.events.returnCreated({ pharmacyId: user.pharmacyId, branchId, salesReturnId, originalSaleId: dto.originalSaleId, totalRefundAmount: totalRefund, medicineIds: [...new Set(lineData.map((l) => l.medicineId))], actorId: user.userId });

    return this.getById(user, salesReturnId);
  }

  private async consumeStepUp(user: AuthenticatedUser, stepUpId?: string): Promise<string> {
    if (!stepUpId) throw new ForbiddenException({ errorCode: 'APPROVAL_REQUIRED', message: 'This return needs pharmacist/admin approval. Ask a supervisor to authorise it.' });
    const rec = await this.prisma.stepUpVerification.findUnique({ where: { id: stepUpId } });
    if (!rec || rec.pharmacyId !== user.pharmacyId || rec.actionType !== 'RETURN_APPROVAL' || rec.status !== 'APPROVED' || !rec.resolvedAt || Date.now() - rec.resolvedAt.getTime() > STEP_UP_MAX_AGE_MS) {
      throw new ForbiddenException({ errorCode: 'APPROVAL_INVALID', message: 'Approval could not be verified. Please have a supervisor re-authorise.' });
    }
    return rec.verifiedByUserId ?? user.userId;
  }

  private async rejectNonReturnable(user: AuthenticatedUser, saleId: string, medicineId: string, reason: string) {
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'NON_RETURNABLE_ITEM_REJECTED', entityType: 'SALE', entityId: saleId, metadata: { medicineId, reason } });
  }

  // =========================================================================
  // Reads
  // =========================================================================
  async list(user: AuthenticatedUser, q: ListReturnsDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const cashierId = user.role === 'cashier' ? user.userId : q.cashierId; // cashiers see only their own
    const branchId = q.branchId && user.accessibleBranchIds.includes(q.branchId) ? q.branchId : undefined;
    const { total, rows } = await this.repo.list(user.pharmacyId, branchId, { page, limit, search: q.search, customerId: q.customerId, cashierId, reasonCode: q.reasonCode, refundMethod: q.refundMethod, dateFrom: q.dateFrom, dateTo: q.dateTo, sortBy: q.sortBy, sortOrder: q.sortOrder });
    return {
      page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)),
      data: rows.map((r) => ({ id: r.id, returnNumber: r.returnNumber, originalSaleId: r.originalSaleId, returnDate: r.returnDate.toISOString(), customerId: r.customerId, processedBy: r.processedBy, approvedBy: r.approvedBy, totalRefundAmount: dec(r.totalRefundAmount), refundMethod: r.refundMethod, itemCount: r._count.items })),
    };
  }

  async getById(user: AuthenticatedUser, id: string) {
    const sr = await this.repo.detailById(user.pharmacyId, id);
    if (!sr) throw new NotFoundException({ errorCode: 'RETURN_NOT_FOUND', message: 'Return not found' });
    if (user.role === 'cashier' && sr.processedBy !== user.userId) throw new ForbiddenException({ errorCode: 'NOT_OWN_RETURN', message: 'You can only view your own returns.' });
    const sale = await this.prisma.sale.findUnique({ where: { id: sr.originalSaleId }, select: { saleNumber: true, saleDate: true } });
    const meds = await this.prisma.medicine.findMany({ where: { id: { in: [...new Set(sr.items.map((i) => i.medicineId))] } }, select: { id: true, genericName: true, brandName: true, sku: true } });
    const nameOf = new Map(meds.map((m) => [m.id, { name: m.brandName ?? m.genericName, sku: m.sku }]));
    return {
      id: sr.id,
      returnNumber: sr.returnNumber,
      originalSaleId: sr.originalSaleId,
      originalSaleNumber: sale?.saleNumber ?? null,
      originalSaleDate: sale?.saleDate?.toISOString() ?? null,
      returnDate: sr.returnDate.toISOString(),
      branchId: sr.branchId,
      customerId: sr.customerId,
      processedBy: sr.processedBy,
      approvedBy: sr.approvedBy,
      totalRefundAmount: dec(sr.totalRefundAmount),
      refundMethod: sr.refundMethod,
      refundReference: sr.refundReference,
      exchangeSaleId: sr.exchangeSaleId,
      notes: sr.notes,
      items: sr.items.map((i) => ({ id: i.id, medicineId: i.medicineId, name: nameOf.get(i.medicineId)?.name ?? i.medicineId, sku: nameOf.get(i.medicineId)?.sku ?? null, batchId: i.batchId, quantityReturned: i.quantityReturned, unitPriceAtSale: dec(i.unitPriceAtSale), refundAmountForLine: dec(i.refundAmountForLine), conditionAssessment: i.conditionAssessment, reasonCode: i.reasonCode, reasonNote: i.reasonNote, conditionPhotoUrl: i.conditionPhotoUrl, restoredToStock: i.restoredToStock, flaggedForReview: i.flaggedForReview })),
    };
  }

  // =========================================================================
  // Reports
  // =========================================================================
  async reportByMedicine(user: AuthenticatedUser, opts: { branchId?: string; dateFrom?: string; dateTo?: string }) {
    const branchId = opts.branchId && user.accessibleBranchIds.includes(opts.branchId) ? opts.branchId : undefined;
    const dateReturn: Prisma.DateTimeFilter = { ...(opts.dateFrom ? { gte: new Date(opts.dateFrom) } : {}), ...(opts.dateTo ? { lte: new Date(opts.dateTo) } : {}) };
    const dateSale: Prisma.DateTimeFilter = { ...dateReturn };

    const returnedRows = await this.prisma.salesReturnItem.groupBy({
      by: ['medicineId'],
      where: { salesReturn: { pharmacyId: user.pharmacyId, ...(branchId ? { branchId } : {}), ...(opts.dateFrom || opts.dateTo ? { returnDate: dateReturn } : {}) } },
      _sum: { quantityReturned: true, refundAmountForLine: true },
      _count: { _all: true },
    });
    const soldRows = await this.prisma.saleItem.groupBy({
      by: ['medicineId'],
      where: { sale: { pharmacyId: user.pharmacyId, status: { not: 'VOIDED' }, ...(branchId ? { branchId } : {}), ...(opts.dateFrom || opts.dateTo ? { saleDate: dateSale } : {}) } },
      _sum: { quantity: true },
    });
    const soldMap = new Map(soldRows.map((r) => [r.medicineId, r._sum.quantity ?? 0]));
    const meds = await this.prisma.medicine.findMany({ where: { id: { in: returnedRows.map((r) => r.medicineId) } }, select: { id: true, genericName: true, brandName: true, sku: true } });
    const nameOf = new Map(meds.map((m) => [m.id, m.brandName ?? m.genericName]));

    return returnedRows
      .map((r) => {
        const sold = soldMap.get(r.medicineId) ?? 0;
        const returnedQty = r._sum.quantityReturned ?? 0;
        return { medicineId: r.medicineId, name: nameOf.get(r.medicineId) ?? r.medicineId, returnedQuantity: returnedQty, soldQuantity: sold, returnCount: r._count._all, totalRefunded: dec(r._sum.refundAmountForLine), returnRatePercent: sold > 0 ? round2((returnedQty / sold) * 100) : null };
      })
      .sort((a, b) => (b.returnRatePercent ?? 999) - (a.returnRatePercent ?? 999));
  }

  async reportByReason(user: AuthenticatedUser, opts: { branchId?: string; dateFrom?: string; dateTo?: string }) {
    const branchId = opts.branchId && user.accessibleBranchIds.includes(opts.branchId) ? opts.branchId : undefined;
    const date: Prisma.DateTimeFilter = { ...(opts.dateFrom ? { gte: new Date(opts.dateFrom) } : {}), ...(opts.dateTo ? { lte: new Date(opts.dateTo) } : {}) };
    const rows = await this.prisma.salesReturnItem.groupBy({
      by: ['reasonCode'],
      where: { salesReturn: { pharmacyId: user.pharmacyId, ...(branchId ? { branchId } : {}), ...(opts.dateFrom || opts.dateTo ? { returnDate: date } : {}) } },
      _sum: { quantityReturned: true, refundAmountForLine: true },
      _count: { _all: true },
    });
    return rows
      .map((r) => ({ reasonCode: r.reasonCode, lineCount: r._count._all, returnedQuantity: r._sum.quantityReturned ?? 0, totalRefunded: dec(r._sum.refundAmountForLine) }))
      .sort((a, b) => b.returnedQuantity - a.returnedQuantity);
  }
}
