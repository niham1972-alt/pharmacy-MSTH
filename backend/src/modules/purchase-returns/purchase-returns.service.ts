import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PurchaseReturnsRepository } from './purchase-returns.repository';
import { InventoryRemovalService } from './integrations/inventory-removal.service';
import { PurchaseReturnEventsEmitter } from './events/purchase-return-events.emitter';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { ListPurchaseReturnsDto } from './dto/list-returns.dto';
import { UpdateSettlementDto } from './dto/update-settlement.dto';
import { ReturnableResult } from './interfaces/purchase-return.interface';

function dec(v: Prisma.Decimal | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : v.toNumber();
}
const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class PurchaseReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: PurchaseReturnsRepository,
    private readonly audit: AuditLogService,
    private readonly inventoryRemoval: InventoryRemovalService,
    private readonly events: PurchaseReturnEventsEmitter,
  ) {}

  // =========================================================================
  // Returnable items for a GRN (advisory pre-check)
  // =========================================================================
  async returnableItems(user: AuthenticatedUser, grnId: string): Promise<ReturnableResult> {
    const grn = await this.repo.grnWithItems(user.pharmacyId, grnId);
    if (!grn) throw new NotFoundException({ errorCode: 'GRN_NOT_FOUND', message: 'Goods receipt not found' });

    const returned = await this.repo.returnedQtyByGrnLine(user.pharmacyId, grnId);
    const medIds = [...new Set(grn.items.map((i) => i.medicineId))];
    const meds = new Map((await this.repo.medicines(user.pharmacyId, medIds)).map((m) => [m.id, m]));
    const batches = await this.repo.findBatches(user.pharmacyId, grn.branchId, grn.items.map((i) => ({ medicineId: i.medicineId, batchNumber: i.batchNumber })));
    const batchByKey = new Map(batches.map((b) => [`${b.medicineId}|${b.batchNumber}`, b]));
    const supplier = (await this.repo.supplierNames(user.pharmacyId, [grn.purchaseOrder.supplierId]))[0];

    const lines = grn.items.map((it) => {
      const already = returned.get(it.id) ?? 0;
      const remaining = it.receivedQuantity - already;
      const batch = batchByKey.get(`${it.medicineId}|${it.batchNumber}`);
      const med = meds.get(it.medicineId);
      return {
        grnItemId: it.id,
        medicineId: it.medicineId,
        name: med?.brandName ?? med?.genericName ?? it.medicineId,
        batchNumber: it.batchNumber,
        batchId: batch?.id ?? null,
        expiryDate: it.expiryDate.toISOString(),
        receivedQuantity: it.receivedQuantity,
        alreadyReturnedQuantity: already,
        remainingQuantity: Math.max(0, remaining),
        currentBatchStock: batch?.currentQuantity ?? null,
        unitCostAtReceipt: dec(it.actualUnitCost),
      };
    });

    return {
      grnId: grn.id,
      grnNumber: grn.grnNumber,
      receivedDate: grn.receivedDate.toISOString(),
      supplierId: grn.purchaseOrder.supplierId,
      supplierName: supplier?.companyName ?? null,
      poNumber: grn.purchaseOrder.poNumber ?? null,
      anyReturnable: lines.some((l) => l.remainingQuantity > 0),
      lines,
    };
  }

  // =========================================================================
  // Create — the full transactional flow (spec §8)
  // =========================================================================
  async createReturn(user: AuthenticatedUser, dto: CreatePurchaseReturnDto) {
    const grn = await this.repo.grnWithItems(user.pharmacyId, dto.originalGrnId);
    if (!grn) throw new NotFoundException({ errorCode: 'GRN_NOT_FOUND', message: 'Original goods receipt not found' });
    const branchId = grn.branchId; // stock lives where it was received
    if (!user.accessibleBranchIds.includes(branchId)) throw new ForbiddenException({ errorCode: 'BRANCH_ACCESS_DENIED', message: `No access to the receiving branch of this GRN.` });

    const grnItemMap = new Map(grn.items.map((i) => [i.id, i]));
    const returnedMap = await this.repo.returnedQtyByGrnLine(user.pharmacyId, dto.originalGrnId);
    const batches = await this.repo.findBatches(user.pharmacyId, branchId, grn.items.map((i) => ({ medicineId: i.medicineId, batchNumber: i.batchNumber })));
    const batchByKey = new Map(batches.map((b) => [`${b.medicineId}|${b.batchNumber}`, b]));

    const lineData = dto.items.map((line) => {
      const it = grnItemMap.get(line.originalGrnItemId);
      if (!it) throw new BadRequestException({ errorCode: 'GRN_ITEM_NOT_FOUND', message: 'A line does not belong to this GRN.' });
      const remaining = it.receivedQuantity - (returnedMap.get(it.id) ?? 0);
      if (line.quantityReturned > remaining) throw new BadRequestException({ errorCode: 'OVER_RETURN', message: `Only ${remaining} unit(s) of ${it.batchNumber} remain returnable from this GRN line.`, data: { remaining } });
      const batch = batchByKey.get(`${it.medicineId}|${it.batchNumber}`);
      const isRecall = line.reasonCode === 'QUALITY_RECALL';
      return {
        originalGrnItemId: it.id,
        medicineId: it.medicineId,
        batchId: batch?.id ?? null,
        quantityReturned: line.quantityReturned,
        unitCostAtReceipt: dec(it.actualUnitCost),
        reasonCode: line.reasonCode,
        reasonNote: line.reasonNote,
        relatedRecallId: isRecall ? line.relatedRecallId : null,
        photoUrl: line.photoUrl,
      };
    });

    const autoExpected = round2(lineData.reduce((s, l) => s + l.unitCostAtReceipt * l.quantityReturned, 0));
    const expectedCreditAmount = dto.expectedCreditAmount != null ? round2(dto.expectedCreditAmount) : autoExpected;

    const { purchaseReturnId, returnNumber } = await this.prisma.$transaction(async (tx) => {
      await this.repo.lockGrn(tx, dto.originalGrnId);
      // Authoritative re-check against concurrent returns.
      const fresh = await this.repo.returnedQtyByGrnLine(user.pharmacyId, dto.originalGrnId, tx);
      for (const l of lineData) {
        const it = grnItemMap.get(l.originalGrnItemId)!;
        const remaining = it.receivedQuantity - (fresh.get(it.id) ?? 0);
        if (l.quantityReturned > remaining) throw new BadRequestException({ errorCode: 'OVER_RETURN', message: `Only ${remaining} unit(s) remain returnable (changed since you started).`, data: { remaining } });
      }

      const number = await this.repo.nextReturnNumber(tx, user.pharmacyId);
      const pr = await this.repo.create(tx, {
        pharmacyId: user.pharmacyId, branchId, returnNumber: number, originalGrnId: dto.originalGrnId, supplierId: grn.purchaseOrder.supplierId,
        initiatedBy: user.userId, settlementStatus: 'PENDING', expectedCreditAmount, notes: dto.notes,
      });

      await tx.purchaseReturnItem.createMany({ data: lineData.map((l) => ({ purchaseReturnId: pr.id, ...l })) });

      // Remove stock (decrement specific batch + Module 5 ledger OUT). Enforces
      // INSUFFICIENT_BATCH_STOCK / INSUFFICIENT_STOCK (spec §21 — can't return sold goods).
      await this.inventoryRemoval.remove(tx, {
        pharmacyId: user.pharmacyId, branchId, purchaseReturnId: pr.id, performedBy: user.userId,
        items: lineData.map((l) => ({ medicineId: l.medicineId, batchId: l.batchId, quantity: l.quantityReturned, unitCost: l.unitCostAtReceipt })),
      });

      return { purchaseReturnId: pr.id, returnNumber: number };
    });

    // Post-commit side effects (fail-safe, non-transactional).
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId, userId: user.userId, action: 'PURCHASE_RETURN_CREATED', entityType: 'PURCHASE_RETURN', entityId: purchaseReturnId, severity: 'SENSITIVE', metadata: { returnNumber, originalGrnId: dto.originalGrnId, grnNumber: grn.grnNumber, supplierId: grn.purchaseOrder.supplierId, expectedCreditAmount, itemCount: lineData.length } });
    for (const l of lineData.filter((x) => x.relatedRecallId)) {
      await this.audit.record({ pharmacyId: user.pharmacyId, branchId, userId: user.userId, action: 'QUALITY_RECALL_RETURN_LINKED', entityType: 'PURCHASE_RETURN', entityId: purchaseReturnId, severity: 'CRITICAL', metadata: { recallId: l.relatedRecallId, medicineId: l.medicineId, batchId: l.batchId } });
    }
    this.events.created({ pharmacyId: user.pharmacyId, branchId, purchaseReturnId, originalGrnId: dto.originalGrnId, supplierId: grn.purchaseOrder.supplierId, expectedCreditAmount, medicineIds: [...new Set(lineData.map((l) => l.medicineId))], actorId: user.userId });

    return this.getById(user, purchaseReturnId);
  }

  // =========================================================================
  // Settlement (financial only — never re-triggers stock movement, spec §11)
  // =========================================================================
  async updateSettlement(user: AuthenticatedUser, id: string, dto: UpdateSettlementDto) {
    const pr = await this.repo.detailById(user.pharmacyId, id);
    if (!pr) throw new NotFoundException({ errorCode: 'RETURN_NOT_FOUND', message: 'Purchase return not found' });

    const needsAmount = dto.settlementStatus === 'CREDITED' || dto.settlementStatus === 'PARTIALLY_CREDITED';
    if (needsAmount && dto.actualCreditedAmount == null) {
      throw new BadRequestException({ errorCode: 'CREDITED_AMOUNT_REQUIRED', message: 'Enter the actual credited amount for a credited settlement.' });
    }
    if (dto.settlementStatus === 'PARTIALLY_CREDITED' && dto.actualCreditedAmount != null && dto.actualCreditedAmount >= dec(pr.expectedCreditAmount)) {
      throw new BadRequestException({ errorCode: 'NOT_PARTIAL', message: 'A partial credit must be less than the expected amount — use "Credited" instead.' });
    }

    const oldStatus = pr.settlementStatus;
    await this.prisma.purchaseReturn.update({
      where: { id },
      data: {
        settlementStatus: dto.settlementStatus,
        actualCreditedAmount: needsAmount ? dto.actualCreditedAmount : null,
        supplierCreditNoteRef: dto.supplierCreditNoteRef ?? pr.supplierCreditNoteRef,
        settledAt: new Date(),
        settledBy: user.userId,
        notes: dto.notes ?? pr.notes,
      },
    });

    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: pr.branchId, userId: user.userId, action: 'SETTLEMENT_STATUS_UPDATED', entityType: 'PURCHASE_RETURN', entityId: id, severity: 'SENSITIVE', metadata: { from: oldStatus, to: dto.settlementStatus, actualCreditedAmount: dto.actualCreditedAmount, creditNoteRef: dto.supplierCreditNoteRef } });
    this.events.settled({ pharmacyId: user.pharmacyId, purchaseReturnId: id, settlementStatus: dto.settlementStatus, actualCreditedAmount: dto.actualCreditedAmount, actorId: user.userId });
    return this.getById(user, id);
  }

  // =========================================================================
  // Reads
  // =========================================================================
  async list(user: AuthenticatedUser, q: ListPurchaseReturnsDto, onlyPending = false) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const branchId = q.branchId && user.accessibleBranchIds.includes(q.branchId) ? q.branchId : undefined;
    const { total, rows } = await this.repo.list(user.pharmacyId, branchId, { page, limit, search: q.search, supplierId: q.supplierId, settlementStatus: q.settlementStatus, reasonCode: q.reasonCode, dateFrom: q.dateFrom, dateTo: q.dateTo, onlyPending, sortBy: q.sortBy, sortOrder: q.sortOrder });
    const supplierIds = [...new Set(rows.map((r) => r.supplierId))];
    const supplierMap = new Map((await this.repo.supplierNames(user.pharmacyId, supplierIds)).map((s) => [s.id, s.companyName]));
    const now = Date.now();
    return {
      page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)),
      data: rows.map((r) => ({
        id: r.id, returnNumber: r.returnNumber, originalGrnId: r.originalGrnId, supplierId: r.supplierId, supplierName: supplierMap.get(r.supplierId) ?? null,
        returnDate: r.returnDate.toISOString(), settlementStatus: r.settlementStatus, expectedCreditAmount: dec(r.expectedCreditAmount), actualCreditedAmount: r.actualCreditedAmount != null ? dec(r.actualCreditedAmount) : null,
        itemCount: r._count.items, ageDays: r.settlementStatus === 'PENDING' ? Math.floor((now - r.returnDate.getTime()) / 86_400_000) : null,
      })),
    };
  }

  async getById(user: AuthenticatedUser, id: string) {
    const pr = await this.repo.detailById(user.pharmacyId, id);
    if (!pr) throw new NotFoundException({ errorCode: 'RETURN_NOT_FOUND', message: 'Purchase return not found' });
    const grn = await this.prisma.goodsReceipt.findUnique({ where: { id: pr.originalGrnId }, select: { grnNumber: true, receivedDate: true } });
    const supplier = (await this.repo.supplierNames(user.pharmacyId, [pr.supplierId]))[0];
    const meds = new Map((await this.repo.medicines(user.pharmacyId, [...new Set(pr.items.map((i) => i.medicineId))])).map((m) => [m.id, m]));
    const expected = dec(pr.expectedCreditAmount);
    const actual = pr.actualCreditedAmount != null ? dec(pr.actualCreditedAmount) : null;
    return {
      id: pr.id,
      returnNumber: pr.returnNumber,
      originalGrnId: pr.originalGrnId,
      originalGrnNumber: grn?.grnNumber ?? null,
      supplierId: pr.supplierId,
      supplierName: supplier?.companyName ?? null,
      branchId: pr.branchId,
      returnDate: pr.returnDate.toISOString(),
      settlementStatus: pr.settlementStatus,
      expectedCreditAmount: expected,
      actualCreditedAmount: actual,
      creditVariance: actual != null ? round2(actual - expected) : null,
      supplierCreditNoteRef: pr.supplierCreditNoteRef,
      settledAt: pr.settledAt?.toISOString() ?? null,
      settledBy: pr.settledBy,
      initiatedBy: pr.initiatedBy,
      notes: pr.notes,
      items: pr.items.map((i) => ({
        id: i.id, medicineId: i.medicineId, name: meds.get(i.medicineId)?.brandName ?? meds.get(i.medicineId)?.genericName ?? i.medicineId, sku: meds.get(i.medicineId)?.sku ?? null,
        batchId: i.batchId, quantityReturned: i.quantityReturned, unitCostAtReceipt: dec(i.unitCostAtReceipt), lineCredit: round2(dec(i.unitCostAtReceipt) * i.quantityReturned),
        reasonCode: i.reasonCode, reasonNote: i.reasonNote, relatedRecallId: i.relatedRecallId, photoUrl: i.photoUrl,
      })),
    };
  }
}
