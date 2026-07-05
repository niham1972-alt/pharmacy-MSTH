import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PurchasesRepository } from './purchases.repository';
import { PurchaseConfigService } from './purchase-config.service';
import { PurchaseEventsEmitter } from './events/purchase-events.emitter';
import { BatchSyncService } from './integrations/batch-sync.service';
import { MedicineCostSyncService } from './integrations/medicine-cost-sync.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateGrnDto, GrnItemDto } from './dto/create-grn.dto';
import { dec } from './purchase-orders.service';

@Injectable()
export class GoodsReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: PurchasesRepository,
    private readonly config: PurchaseConfigService,
    private readonly events: PurchaseEventsEmitter,
    private readonly batchSync: BatchSyncService,
    private readonly inventory: InventoryService,
    private readonly costSync: MedicineCostSyncService,
    private readonly audit: AuditLogService,
  ) {}

  private resolveBranch(user: AuthenticatedUser, requested?: string): string {
    const branchId = requested ?? user.branchId;
    if (!user.accessibleBranchIds.includes(branchId)) {
      throw new ForbiddenException({ errorCode: 'BRANCH_ACCESS_DENIED', message: `You do not have access to branch ${branchId}` });
    }
    return branchId;
  }

  private variancePct(expected: number, actual: number): number {
    if (expected <= 0) return actual > 0 ? 100 : 0;
    return Math.abs(actual - expected) / expected * 100;
  }

  /**
   * The heart of the module: a single all-or-nothing transaction that writes the
   * GRN, creates batches, increments stock, updates cost, advances PO status and
   * seeds the payable — through Module 5/6/2 seams. Any failure rolls everything
   * back (spec §3/§8/§11).
   */
  async confirmGrn(user: AuthenticatedUser, dto: CreateGrnDto) {
    const branchId = this.resolveBranch(user, dto.branchId);
    const cfg = this.config.get();
    const isDirect = !dto.purchaseOrderId;

    // --- Pre-transaction validation -----------------------------------------
    let po: Prisma.PurchaseOrderGetPayload<{ include: { items: true } }> | null = null;
    if (!isDirect) {
      po = await this.prisma.purchaseOrder.findFirst({ where: { id: dto.purchaseOrderId, pharmacyId: user.pharmacyId }, include: { items: true } });
      if (!po) throw new NotFoundException({ errorCode: 'PO_NOT_FOUND', message: 'Purchase order not found' });
      if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
        throw new ConflictException({ errorCode: 'PO_NOT_RECEIVABLE', message: `Cannot receive against a ${po.status} PO.` });
      }
    } else {
      if (!dto.supplierId) throw new BadRequestException({ errorCode: 'SUPPLIER_REQUIRED', message: 'A supplier is required for a direct receipt.' });
      const supplier = await this.repo.supplierById(user.pharmacyId, dto.supplierId);
      if (!supplier) throw new BadRequestException({ errorCode: 'INVALID_SUPPLIER', message: 'Supplier not found.' });
    }

    const now = new Date();
    let hasVariance: boolean = false;
    let maxVariance = 0;

    for (const item of dto.items) {
      // Expiry must be future unless an explicit, reasoned override (spec §10).
      const expiry = new Date(item.expiryDate);
      if (expiry.getTime() <= now.getTime()) {
        if (!item.expiryOverridden || !item.expiryOverrideReason?.trim()) {
          throw new BadRequestException({ errorCode: 'EXPIRED_STOCK', message: `Batch ${item.batchNumber} is expired. Provide an override reason to receive it.` });
        }
      }
      // Over-receipt tolerance check (spec §10).
      if (!isDirect) {
        const poItem = po!.items.find((pi) => pi.id === item.purchaseOrderItemId);
        if (!poItem) throw new BadRequestException({ errorCode: 'INVALID_PO_ITEM', message: 'Line item does not belong to this PO.' });
        const remaining = poItem.orderedQuantity - poItem.receivedQuantity;
        const maxReceivable = Math.floor(remaining * (1 + cfg.overReceiptTolerancePercent / 100));
        if (item.receivedQuantity > maxReceivable) {
          throw new BadRequestException({ errorCode: 'OVER_RECEIPT', message: `Received quantity for ${item.batchNumber} exceeds the remaining orderable amount (${maxReceivable}).` });
        }
        const v = this.variancePct(dec(poItem.expectedUnitCost), item.actualUnitCost);
        maxVariance = Math.max(maxVariance, v);
        if (v > cfg.varianceWarnPercent) hasVariance = true;
      }
    }

    if (hasVariance && maxVariance > cfg.varianceBlockPercent && !dto.varianceAcknowledged) {
      throw new BadRequestException({ errorCode: 'VARIANCE_REQUIRES_ACK', message: `Cost variance of ${maxVariance.toFixed(1)}% exceeds the ${cfg.varianceBlockPercent}% limit. Acknowledge to proceed.` });
    }

    // --- Transaction --------------------------------------------------------
    const result = await this.prisma.$transaction(async (tx) => {
      const grnNumber = await this.repo.nextNumber(tx, user.pharmacyId, 'GRN');

      // Direct receipt: create the retroactive RECEIVED PO first so downstream
      // reporting is consistent (spec §2.2).
      let poId = dto.purchaseOrderId!;
      let poItemsById = new Map<string, { orderedQuantity: number; receivedQuantity: number }>();
      if (isDirect) {
        const poNumber = await this.repo.nextNumber(tx, user.pharmacyId, 'PO');
        const supplier = await tx.supplier.findUnique({ where: { id: dto.supplierId! } });
        const subTotal = dto.items.reduce((s, i) => s + i.receivedQuantity * i.actualUnitCost, 0);
        const created = await tx.purchaseOrder.create({
          data: {
            pharmacyId: user.pharmacyId,
            branchId,
            poNumber,
            supplierId: dto.supplierId!,
            status: 'RECEIVED',
            isDirectGrn: true,
            orderDate: now,
            dueDate: new Date(now.getTime() + (supplier?.paymentTermsDays ?? 30) * 86400000),
            subTotal,
            grandTotal: subTotal,
            createdBy: user.userId,
            approvedBy: 'DIRECT_GRN',
            approvedAt: now,
            items: {
              create: dto.items.map((i) => ({
                medicineId: i.medicineId,
                orderedQuantity: i.receivedQuantity,
                receivedQuantity: i.receivedQuantity,
                expectedUnitCost: i.actualUnitCost,
                lineTotal: i.receivedQuantity * i.actualUnitCost,
              })),
            },
          },
          include: { items: true },
        });
        poId = created.id;
        // Map direct items to the created PO items by position.
        dto.items.forEach((i, idx) => (i.purchaseOrderItemId = created.items[idx].id));
      } else {
        // Lock PO item rows for the transaction to prevent concurrent double-receipt (spec §21).
        await tx.$queryRaw`SELECT id FROM "PurchaseOrderItem" WHERE "purchaseOrderId" = ${poId} FOR UPDATE`;
        const fresh = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { items: true } });
        poItemsById = new Map(fresh!.items.map((i) => [i.id, { orderedQuantity: i.orderedQuantity, receivedQuantity: i.receivedQuantity }]));
      }

      // 1. GoodsReceipt + items
      const grnData: Prisma.GoodsReceiptUncheckedCreateInput = {
        pharmacyId: user.pharmacyId,
        branchId,
        grnNumber,
        purchaseOrderId: poId,
        receivedBy: user.userId,
        notes: dto.notes,
        hasVariance,
        varianceAcknowledgedBy: dto.varianceAcknowledged ? user.userId : null,
        varianceNote: dto.varianceNote,
        items: {
          create: dto.items.map((i) => ({
            purchaseOrderItemId: i.purchaseOrderItemId!,
            medicineId: i.medicineId,
            receivedQuantity: i.receivedQuantity,
            freeQuantity: i.freeQuantity ?? 0,
            batchNumber: i.batchNumber,
            expiryDate: new Date(i.expiryDate),
            actualUnitCost: i.actualUnitCost,
            expiryOverridden: i.expiryOverridden ?? false,
            expiryOverrideReason: i.expiryOverrideReason,
          })),
        },
      };
      const grn = await tx.goodsReceipt.create({ data: grnData, include: { items: true } });

      // 2-5. Per line: cost -> stock -> batch -> PO item received qty
      for (const i of dto.items) {
        const totalUnits = i.receivedQuantity + (i.freeQuantity ?? 0);
        const med = await tx.medicine.findUnique({ where: { id: i.medicineId }, select: { currentStock: true, costPrice: true } });
        if (!med) throw new BadRequestException({ errorCode: 'INVALID_MEDICINE', message: `Medicine ${i.medicineId} not found.` });

        await this.costSync.applyCosting(tx, {
          pharmacyId: user.pharmacyId,
          medicineId: i.medicineId,
          oldStock: med.currentStock,
          oldCost: dec(med.costPrice),
          actualUnitCost: i.actualUnitCost,
          receivedQuantity: i.receivedQuantity,
          freeQuantity: i.freeQuantity ?? 0,
          rule: cfg.costingRule,
          changedBy: user.userId,
        });
        const batch = await this.batchSync.createBatch(tx, {
          pharmacyId: user.pharmacyId,
          branchId,
          medicineId: i.medicineId,
          batchNumber: i.batchNumber,
          quantity: totalUnits,
          expiryDate: new Date(i.expiryDate),
        });
        // Stock is now owned by Module 5 — record IN through its ledger contract
        // (enrolled in this GRN transaction so it's all-or-nothing).
        await this.inventory.recordStockIn(
          { pharmacyId: user.pharmacyId, branchId, medicineId: i.medicineId, batchId: batch.id, quantity: totalUnits, unitCost: i.actualUnitCost, reasonCode: 'PURCHASE_RECEIPT', referenceModule: 'PURCHASE', referenceId: grn.id, performedBy: user.userId },
          tx,
        );
        if (!isDirect) {
          await tx.purchaseOrderItem.update({ where: { id: i.purchaseOrderItemId! }, data: { receivedQuantity: { increment: i.receivedQuantity } } });
        }
      }

      // 6. Recompute PO status + seed payable due date
      if (!isDirect) {
        const after = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { items: true } });
        const allReceived = after!.items.every((it) => it.receivedQuantity >= it.orderedQuantity);
        const supplier = await tx.supplier.findUnique({ where: { id: after!.supplierId } });
        await tx.purchaseOrder.update({
          where: { id: poId },
          data: {
            status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
            dueDate: after!.dueDate ?? new Date(now.getTime() + (supplier?.paymentTermsDays ?? 30) * 86400000),
          },
        });
      }

      return { grn, poId };
    });

    // 7. Audit + 8. events (outside tx — non-transactional side effects)
    await this.audit.record({
      pharmacyId: user.pharmacyId,
      branchId,
      userId: user.userId,
      action: 'GRN_CREATED',
      entityType: 'GOODS_RECEIPT',
      entityId: result.grn.id,
      metadata: { grnNumber: result.grn.grnNumber, lineCount: dto.items.length, hasVariance, direct: isDirect },
    });
    for (const i of dto.items.filter((x) => x.expiryOverridden)) {
      await this.audit.record({
        pharmacyId: user.pharmacyId,
        branchId,
        userId: user.userId,
        action: 'EXPIRY_OVERRIDE_USED',
        entityType: 'GOODS_RECEIPT',
        entityId: result.grn.id,
        metadata: { batchNumber: i.batchNumber, reason: i.expiryOverrideReason },
      });
    }
    this.events.stockReceived({ pharmacyId: user.pharmacyId, branchId, goodsReceiptId: result.grn.id, medicineIds: dto.items.map((i) => i.medicineId), actorId: user.userId });

    return this.getById(user, result.grn.id);
  }

  async list(user: AuthenticatedUser, page = 1, limit = 20, purchaseOrderId?: string) {
    const branchId = this.resolveBranch(user);
    const where: Prisma.GoodsReceiptWhereInput = { pharmacyId: user.pharmacyId, branchId, ...(purchaseOrderId ? { purchaseOrderId } : {}) };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.goodsReceipt.count({ where }),
      this.prisma.goodsReceipt.findMany({
        where,
        orderBy: { receivedDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { purchaseOrder: { select: { poNumber: true, supplier: { select: { name: true } } } }, _count: { select: { items: true } } },
      }),
    ]);
    return {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      data: rows.map((g) => ({
        id: g.id,
        grnNumber: g.grnNumber,
        poNumber: g.purchaseOrder.poNumber,
        supplierName: g.purchaseOrder.supplier?.name ?? null,
        receivedDate: g.receivedDate.toISOString(),
        itemCount: g._count.items,
        hasVariance: g.hasVariance,
      })),
    };
  }

  async getById(user: AuthenticatedUser, id: string) {
    const g = await this.prisma.goodsReceipt.findFirst({
      where: { id, pharmacyId: user.pharmacyId },
      include: { items: true, purchaseOrder: { select: { poNumber: true, supplierId: true, supplier: { select: { name: true } } } } },
    });
    if (!g) throw new NotFoundException({ errorCode: 'GRN_NOT_FOUND', message: 'Goods receipt not found' });
    const medIds = [...new Set(g.items.map((i) => i.medicineId))];
    const meds = await this.prisma.medicine.findMany({ where: { id: { in: medIds } }, select: { id: true, genericName: true, brandName: true } });
    const nameOf = new Map(meds.map((m) => [m.id, m.brandName ?? m.genericName]));
    return {
      id: g.id,
      grnNumber: g.grnNumber,
      purchaseOrderId: g.purchaseOrderId,
      poNumber: g.purchaseOrder.poNumber,
      supplierName: g.purchaseOrder.supplier?.name ?? null,
      receivedDate: g.receivedDate.toISOString(),
      notes: g.notes,
      hasVariance: g.hasVariance,
      varianceNote: g.varianceNote,
      items: g.items.map((i) => ({
        id: i.id,
        medicineId: i.medicineId,
        medicineName: nameOf.get(i.medicineId) ?? i.medicineId,
        receivedQuantity: i.receivedQuantity,
        freeQuantity: i.freeQuantity,
        batchNumber: i.batchNumber,
        expiryDate: i.expiryDate.toISOString(),
        actualUnitCost: dec(i.actualUnitCost),
        expiryOverridden: i.expiryOverridden,
      })),
    };
  }

  async acknowledgeVariance(user: AuthenticatedUser, id: string, note?: string) {
    const g = await this.prisma.goodsReceipt.findFirst({ where: { id, pharmacyId: user.pharmacyId } });
    if (!g) throw new NotFoundException({ errorCode: 'GRN_NOT_FOUND', message: 'Goods receipt not found' });
    await this.prisma.goodsReceipt.update({ where: { id }, data: { varianceAcknowledgedBy: user.userId, varianceNote: note ?? g.varianceNote } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: g.branchId, userId: user.userId, action: 'GRN_VARIANCE_ACKNOWLEDGED', entityType: 'GOODS_RECEIPT', entityId: id, metadata: { note } });
    return { id, acknowledged: true };
  }
}
