import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PurchasesRepository } from './purchases.repository';
import { PurchaseConfigService } from './purchase-config.service';
import { PurchaseEventsEmitter } from './events/purchase-events.emitter';
import { CreatePurchaseOrderDto, QueryPurchaseOrdersDto, RejectPoDto, UpdatePurchaseOrderDto, CancelPoDto } from './dto/purchase-order.dto';

export function dec(v: Prisma.Decimal | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : v.toNumber();
}

const PRE_RECEIPT_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'];

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly repo: PurchasesRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: PurchaseEventsEmitter,
    private readonly config: PurchaseConfigService,
  ) {}

  private resolveBranch(user: AuthenticatedUser, requested?: string): string {
    const branchId = requested ?? user.branchId;
    if (!user.accessibleBranchIds.includes(branchId)) {
      throw new ForbiddenException({ errorCode: 'BRANCH_ACCESS_DENIED', message: `You do not have access to branch ${branchId}` });
    }
    return branchId;
  }

  private computeTotals<T extends { orderedQuantity: number; expectedUnitCost: number; taxRatePercent?: number }>(items: T[]) {
    let subTotal = 0;
    let taxTotal = 0;
    const lines = items.map((it): T & { lineTotal: number } => {
      const net = it.orderedQuantity * it.expectedUnitCost;
      const tax = (net * (it.taxRatePercent ?? 0)) / 100;
      subTotal += net;
      taxTotal += tax;
      return { ...it, lineTotal: Math.round((net + tax) * 100) / 100 };
    });
    subTotal = Math.round(subTotal * 100) / 100;
    taxTotal = Math.round(taxTotal * 100) / 100;
    return { lines, subTotal, taxTotal, grandTotal: Math.round((subTotal + taxTotal) * 100) / 100 };
  }

  private async assertMedicinesOrderable(pharmacyId: string, medicineIds: string[]) {
    const meds = await this.prisma.medicine.findMany({ where: { pharmacyId, id: { in: medicineIds } }, select: { id: true, status: true } });
    const found = new Map(meds.map((m) => [m.id, m.status]));
    for (const id of medicineIds) {
      if (!found.has(id)) throw new BadRequestException({ errorCode: 'INVALID_MEDICINE', message: `Medicine ${id} not found.` });
      if (found.get(id) === 'DISCONTINUED') throw new BadRequestException({ errorCode: 'MEDICINE_DISCONTINUED', message: 'Cannot order a discontinued medicine.' });
    }
  }

  async list(user: AuthenticatedUser, dto: QueryPurchaseOrdersDto) {
    const branchId = this.resolveBranch(user, dto.branchId);
    const { total, rows, page, limit } = await this.repo.listOrders(user.pharmacyId, branchId, dto);
    return {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      data: rows.map((o) => ({
        id: o.id,
        poNumber: o.poNumber,
        // `name` alias so the existing Purchases UI keeps working against Module 7.
        supplier: o.supplier ? { id: o.supplier.id, name: o.supplier.companyName, companyName: o.supplier.companyName } : null,
        status: o.status,
        paymentStatus: o.paymentStatus,
        orderDate: o.orderDate.toISOString(),
        expectedDeliveryDate: o.expectedDeliveryDate?.toISOString() ?? null,
        dueDate: o.dueDate?.toISOString() ?? null,
        itemCount: o._count.items,
        grandTotal: dec(o.grandTotal),
        amountPaid: dec(o.amountPaid),
        isDirectGrn: o.isDirectGrn,
      })),
    };
  }

  async getById(user: AuthenticatedUser, id: string) {
    const po = await this.repo.orderById(user.pharmacyId, id);
    if (!po) throw new NotFoundException({ errorCode: 'PO_NOT_FOUND', message: 'Purchase order not found' });
    return this.serialize(po);
  }

  private async serialize(po: NonNullable<Awaited<ReturnType<PurchasesRepository['orderById']>>>) {
    const medIds = [...new Set(po.items.map((i) => i.medicineId))];
    const meds = await this.prisma.medicine.findMany({ where: { id: { in: medIds } }, select: { id: true, genericName: true, brandName: true, sku: true } });
    const nameOf = new Map(meds.map((m) => [m.id, { name: m.brandName ?? m.genericName, sku: m.sku }]));
    return {
      id: po.id,
      poNumber: po.poNumber,
      // Safe subset (no bank details) + `name` alias for the existing UI.
      supplier: po.supplier ? { id: po.supplier.id, name: po.supplier.companyName, companyName: po.supplier.companyName, supplierType: po.supplier.supplierType, paymentTermsCode: po.supplier.paymentTermsCode } : null,
      status: po.status,
      paymentStatus: po.paymentStatus,
      orderDate: po.orderDate.toISOString(),
      expectedDeliveryDate: po.expectedDeliveryDate?.toISOString() ?? null,
      dueDate: po.dueDate?.toISOString() ?? null,
      notes: po.notes,
      subTotal: dec(po.subTotal),
      taxTotal: dec(po.taxTotal),
      grandTotal: dec(po.grandTotal),
      amountPaid: dec(po.amountPaid),
      outstanding: Math.round((dec(po.grandTotal) - dec(po.amountPaid)) * 100) / 100,
      isDirectGrn: po.isDirectGrn,
      approvedBy: po.approvedBy,
      approvedAt: po.approvedAt?.toISOString() ?? null,
      rejectedReason: po.rejectedReason,
      cancelledReason: po.cancelledReason,
      items: po.items.map((i) => ({
        id: i.id,
        medicineId: i.medicineId,
        medicineName: nameOf.get(i.medicineId)?.name ?? i.medicineId,
        sku: nameOf.get(i.medicineId)?.sku ?? null,
        orderedQuantity: i.orderedQuantity,
        receivedQuantity: i.receivedQuantity,
        expectedUnitCost: dec(i.expectedUnitCost),
        taxRatePercent: dec(i.taxRatePercent),
        lineTotal: dec(i.lineTotal),
      })),
      goodsReceipts: po.goodsReceipts.map((g) => ({
        id: g.id,
        grnNumber: g.grnNumber,
        receivedDate: g.receivedDate.toISOString(),
        hasVariance: g.hasVariance,
        itemCount: g.items.length,
      })),
      payments: po.payments.map((p) => ({ id: p.id, amount: dec(p.amount), method: p.method, paymentDate: p.paymentDate.toISOString(), referenceNumber: p.referenceNumber })),
      attachments: po.attachments,
    };
  }

  async create(user: AuthenticatedUser, dto: CreatePurchaseOrderDto) {
    const branchId = this.resolveBranch(user, dto.branchId);
    const supplier = await this.repo.supplierById(user.pharmacyId, dto.supplierId);
    if (!supplier) throw new BadRequestException({ errorCode: 'INVALID_SUPPLIER', message: 'Supplier not found.' });
    await this.assertMedicinesOrderable(user.pharmacyId, dto.items.map((i) => i.medicineId));

    const { lines, subTotal, taxTotal, grandTotal } = this.computeTotals(dto.items);

    const po = await this.prisma.$transaction(async (tx) => {
      const poNumber = await this.repo.nextNumber(tx, user.pharmacyId, 'PO');
      return tx.purchaseOrder.create({
        data: {
          pharmacyId: user.pharmacyId,
          branchId,
          poNumber,
          supplierId: dto.supplierId,
          status: 'DRAFT',
          expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
          notes: dto.notes,
          subTotal,
          taxTotal,
          grandTotal,
          createdBy: user.userId,
          items: {
            create: lines.map((l) => ({
              medicineId: l.medicineId,
              orderedQuantity: l.orderedQuantity,
              expectedUnitCost: l.expectedUnitCost,
              taxRatePercent: l.taxRatePercent ?? 0,
              lineTotal: l.lineTotal,
            })),
          },
        },
        include: this.fullInclude(),
      });
    });

    await this.log(user, 'PO_CREATED', po.id, { poNumber: po.poNumber, grandTotal });
    this.events.poCreated({ pharmacyId: user.pharmacyId, branchId, purchaseOrderId: po.id, actorId: user.userId });
    return this.serialize(po);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdatePurchaseOrderDto) {
    const existing = await this.repo.orderByIdRaw(user.pharmacyId, id);
    if (!existing) throw new NotFoundException({ errorCode: 'PO_NOT_FOUND', message: 'Purchase order not found' });
    if (existing.status !== 'DRAFT') {
      throw new ConflictException({ errorCode: 'PO_LOCKED', message: 'Only DRAFT purchase orders can be edited.' });
    }

    let totals: {
      lines: Array<{ medicineId: string; orderedQuantity: number; expectedUnitCost: number; taxRatePercent?: number; lineTotal: number }>;
      subTotal: number;
      taxTotal: number;
      grandTotal: number;
    } | null = null;
    if (dto.items) {
      await this.assertMedicinesOrderable(user.pharmacyId, dto.items.map((i) => i.medicineId));
      totals = this.computeTotals(dto.items);
    }

    const po = await this.prisma.$transaction(async (tx) => {
      if (totals) {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
        await tx.purchaseOrderItem.createMany({
          data: totals.lines.map((l) => ({
            purchaseOrderId: id,
            medicineId: l.medicineId,
            orderedQuantity: l.orderedQuantity,
            expectedUnitCost: l.expectedUnitCost,
            taxRatePercent: l.taxRatePercent ?? 0,
            lineTotal: l.lineTotal,
          })),
        });
      }
      return tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: dto.supplierId,
          expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : undefined,
          notes: dto.notes,
          ...(totals ? { subTotal: totals.subTotal, taxTotal: totals.taxTotal, grandTotal: totals.grandTotal } : {}),
        },
        include: this.fullInclude(),
      });
    });

    await this.log(user, 'PO_UPDATED', id, {});
    return this.serialize(po);
  }

  async submit(user: AuthenticatedUser, id: string) {
    const po = await this.repo.orderByIdRaw(user.pharmacyId, id);
    if (!po) throw new NotFoundException({ errorCode: 'PO_NOT_FOUND', message: 'Purchase order not found' });
    if (po.status !== 'DRAFT') throw new ConflictException({ errorCode: 'INVALID_TRANSITION', message: 'Only DRAFT POs can be submitted.' });
    if (po.items.length === 0) throw new BadRequestException({ errorCode: 'EMPTY_PO', message: 'Add at least one line item before submitting.' });

    const { autoApproveThreshold } = await this.config.get(user.pharmacyId, po.branchId);
    const autoApprove = dec(po.grandTotal) <= autoApproveThreshold;

    await this.prisma.purchaseOrder.update({
      where: { id },
      data: autoApprove
        ? { status: 'APPROVED', approvedBy: 'AUTO_APPROVED', approvedAt: new Date() }
        : { status: 'PENDING_APPROVAL' },
    });

    await this.log(user, 'PO_SUBMITTED', id, { autoApprove });
    if (autoApprove) {
      await this.log(user, 'PO_APPROVED', id, { auto: true });
      this.events.poApproved({ pharmacyId: user.pharmacyId, branchId: po.branchId, purchaseOrderId: id, actorId: 'AUTO' });
    }
    return { id, status: autoApprove ? 'APPROVED' : 'PENDING_APPROVAL', autoApproved: autoApprove };
  }

  async approve(user: AuthenticatedUser, id: string) {
    const po = await this.repo.orderByIdRaw(user.pharmacyId, id);
    if (!po) throw new NotFoundException({ errorCode: 'PO_NOT_FOUND', message: 'Purchase order not found' });
    if (po.status !== 'PENDING_APPROVAL') throw new ConflictException({ errorCode: 'INVALID_TRANSITION', message: 'PO is not awaiting approval.' });
    await this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'APPROVED', approvedBy: user.userId, approvedAt: new Date() } });
    await this.log(user, 'PO_APPROVED', id, {});
    this.events.poApproved({ pharmacyId: user.pharmacyId, branchId: po.branchId, purchaseOrderId: id, actorId: user.userId });
    return { id, status: 'APPROVED' };
  }

  async reject(user: AuthenticatedUser, id: string, dto: RejectPoDto) {
    const po = await this.repo.orderByIdRaw(user.pharmacyId, id);
    if (!po) throw new NotFoundException({ errorCode: 'PO_NOT_FOUND', message: 'Purchase order not found' });
    if (po.status !== 'PENDING_APPROVAL') throw new ConflictException({ errorCode: 'INVALID_TRANSITION', message: 'PO is not awaiting approval.' });
    await this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'REJECTED', rejectedReason: dto.reason } });
    await this.log(user, 'PO_REJECTED', id, { reason: dto.reason });
    this.events.poRejected({ pharmacyId: user.pharmacyId, branchId: po.branchId, purchaseOrderId: id, actorId: user.userId });
    return { id, status: 'REJECTED' };
  }

  async cancel(user: AuthenticatedUser, id: string, dto: CancelPoDto) {
    const po = await this.repo.orderByIdRaw(user.pharmacyId, id);
    if (!po) throw new NotFoundException({ errorCode: 'PO_NOT_FOUND', message: 'Purchase order not found' });
    if (['RECEIVED', 'CLOSED', 'CANCELLED', 'REJECTED'].includes(po.status)) {
      throw new ConflictException({ errorCode: 'INVALID_TRANSITION', message: `Cannot cancel a ${po.status} PO.` });
    }
    // After any receipt, cancellation requires admin + a reason (spec §11).
    if (po.status === 'PARTIALLY_RECEIVED') {
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        throw new ForbiddenException({ errorCode: 'ADMIN_OVERRIDE_REQUIRED', message: 'Cancelling a partially-received PO requires an admin.' });
      }
      if (!dto.reason?.trim()) throw new BadRequestException({ errorCode: 'REASON_REQUIRED', message: 'A cancellation reason is required.' });
    }
    await this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED', cancelledReason: dto.reason } });
    await this.log(user, 'PO_CANCELLED', id, { reason: dto.reason, fromStatus: po.status });
    return { id, status: 'CANCELLED' };
  }

  async pendingApprovals(user: AuthenticatedUser, branchId?: string) {
    const scope = this.resolveBranch(user, branchId);
    const rows = await this.repo.pendingApprovals(user.pharmacyId, scope);
    return rows.map((o) => ({ id: o.id, poNumber: o.poNumber, supplierName: o.supplier?.companyName ?? null, grandTotal: dec(o.grandTotal), itemCount: o._count.items, createdAt: o.createdAt.toISOString() }));
  }

  async summary(user: AuthenticatedUser, branchId?: string) {
    const scope = this.resolveBranch(user, branchId);
    const { pending, overdue, unpaidAgg } = await this.repo.summary(user.pharmacyId, scope);
    const overdueAmount = overdue.reduce((sum, o) => sum + (dec(o.grandTotal) - dec(o.amountPaid)), 0);
    const outstanding = dec(unpaidAgg._sum.grandTotal) - dec(unpaidAgg._sum.amountPaid);
    return {
      pendingOrders: pending,
      overduePayablesCount: overdue.length,
      overduePayablesAmount: Math.round(overdueAmount * 100) / 100,
      totalOutstanding: Math.round(outstanding * 100) / 100,
    };
  }

  private fullInclude() {
    return {
      supplier: true,
      items: true,
      goodsReceipts: { include: { items: true }, orderBy: { receivedDate: 'desc' as const } },
      payments: { orderBy: { paymentDate: 'desc' as const } },
      attachments: true,
    } satisfies Prisma.PurchaseOrderInclude;
  }

  private log(user: AuthenticatedUser, action: string, entityId: string, metadata: Record<string, unknown>) {
    return this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action, entityType: 'PURCHASE_ORDER', entityId, metadata });
  }
}
