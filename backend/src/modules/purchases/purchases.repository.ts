import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryPurchaseOrdersDto } from './dto/purchase-order.dto';

@Injectable()
export class PurchasesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Race-safe auto numbering (spec §22) ---------------------------------
  // pg_advisory_xact_lock serializes concurrent number generation for the same
  // pharmacy+prefix; the lock releases automatically at transaction end.
  async nextNumber(tx: Prisma.TransactionClient, pharmacyId: string, kind: 'PO' | 'GRN'): Promise<string> {
    const year = new Date().getFullYear();
    const key = `${pharmacyId}:${kind}:${year}`;
    // $executeRaw (not $queryRaw) because pg_advisory_xact_lock returns `void`,
    // which $queryRaw cannot deserialize.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const count =
      kind === 'PO'
        ? await tx.purchaseOrder.count({ where: { pharmacyId, poNumber: { startsWith: `PO-${year}-` } } })
        : await tx.goodsReceipt.count({ where: { pharmacyId, grnNumber: { startsWith: `GRN-${year}-` } } });
    const seq = String(count + 1).padStart(6, '0');
    return `${kind}-${year}-${seq}`;
  }

  // --- Suppliers (owned by Module 7; read here for PO wiring) --------------
  suppliers(pharmacyId: string) {
    return this.prisma.supplier.findMany({ where: { pharmacyId, isActive: true }, orderBy: { companyName: 'asc' } });
  }

  supplierById(pharmacyId: string, id: string) {
    return this.prisma.supplier.findFirst({ where: { id, pharmacyId } });
  }

  createSupplier(data: Prisma.SupplierUncheckedCreateInput) {
    return this.prisma.supplier.create({ data });
  }

  // --- Purchase Orders -----------------------------------------------------
  async listOrders(pharmacyId: string, branchId: string, q: QueryPurchaseOrdersDto) {
    const where: Prisma.PurchaseOrderWhereInput = { pharmacyId, branchId };
    if (q.supplierId) where.supplierId = q.supplierId;
    if (q.status) where.status = q.status as Prisma.PurchaseOrderWhereInput['status'];
    if (q.paymentStatus) where.paymentStatus = q.paymentStatus as Prisma.PurchaseOrderWhereInput['paymentStatus'];
    if (q.dateFrom || q.dateTo) {
      where.orderDate = { ...(q.dateFrom ? { gte: new Date(q.dateFrom) } : {}), ...(q.dateTo ? { lte: new Date(q.dateTo) } : {}) };
    }
    if (q.search) {
      where.OR = [
        { poNumber: { contains: q.search, mode: 'insensitive' } },
        { supplier: { companyName: { contains: q.search, mode: 'insensitive' } } },
      ];
    }

    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const orderBy = { [q.sortBy ?? 'orderDate']: q.sortOrder ?? 'desc' } as Prisma.PurchaseOrderOrderByWithRelationInput;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { supplier: { select: { id: true, companyName: true } }, _count: { select: { items: true } } },
      }),
    ]);
    return { total, rows, page, limit };
  }

  orderById(pharmacyId: string, id: string) {
    return this.prisma.purchaseOrder.findFirst({
      where: { id, pharmacyId },
      include: {
        supplier: true,
        items: true,
        goodsReceipts: { include: { items: true }, orderBy: { receivedDate: 'desc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
        attachments: true,
      },
    });
  }

  orderByIdRaw(pharmacyId: string, id: string) {
    return this.prisma.purchaseOrder.findFirst({ where: { id, pharmacyId }, include: { items: true } });
  }

  pendingApprovals(pharmacyId: string, branchId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { pharmacyId, branchId, status: 'PENDING_APPROVAL' },
      include: { supplier: { select: { companyName: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async summary(pharmacyId: string, branchId: string) {
    const [pending, overdue, unpaidAgg] = await Promise.all([
      this.prisma.purchaseOrder.count({ where: { pharmacyId, branchId, status: { in: ['PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED'] } } }),
      this.prisma.purchaseOrder.findMany({
        where: { pharmacyId, branchId, paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] }, dueDate: { lt: new Date() } },
        select: { grandTotal: true, amountPaid: true },
      }),
      this.prisma.purchaseOrder.aggregate({
        where: { pharmacyId, branchId, paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
        _sum: { grandTotal: true, amountPaid: true },
      }),
    ]);
    return { pending, overdue, unpaidAgg };
  }
}
