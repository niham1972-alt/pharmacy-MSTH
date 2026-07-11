import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PurchaseReturnsRepository {
  constructor(private readonly prisma: PrismaService) {}

  grnWithItems(pharmacyId: string, grnId: string) {
    return this.prisma.goodsReceipt.findFirst({
      where: { id: grnId, pharmacyId },
      include: { items: true, purchaseOrder: { select: { supplierId: true, poNumber: true } } },
    });
  }

  /** Sum already-returned qty per original GRN line, across every prior return. */
  async returnedQtyByGrnLine(pharmacyId: string, grnId: string, tx?: Prisma.TransactionClient): Promise<Map<string, number>> {
    const client = tx ?? this.prisma;
    const rows = await client.purchaseReturnItem.groupBy({
      by: ['originalGrnItemId'],
      where: { purchaseReturn: { pharmacyId, originalGrnId: grnId } },
      _sum: { quantityReturned: true },
    });
    return new Map(rows.map((r) => [r.originalGrnItemId, r._sum.quantityReturned ?? 0]));
  }

  medicines(pharmacyId: string, ids: string[]) {
    return this.prisma.medicine.findMany({ where: { pharmacyId, id: { in: ids } }, select: { id: true, genericName: true, brandName: true, sku: true } });
  }

  supplierNames(pharmacyId: string, ids: string[]) {
    return this.prisma.supplier.findMany({ where: { pharmacyId, id: { in: ids } }, select: { id: true, companyName: true } });
  }

  /** Resolve Module 6 batches for GRN lines by (medicineId, batchNumber) in a branch. */
  async findBatches(pharmacyId: string, branchId: string, keys: Array<{ medicineId: string; batchNumber: string }>) {
    if (keys.length === 0) return [];
    return this.prisma.medicineBatch.findMany({
      where: { pharmacyId, branchId, OR: keys.map((k) => ({ medicineId: k.medicineId, batchNumber: k.batchNumber })) },
      select: { id: true, medicineId: true, batchNumber: true, currentQuantity: true },
    });
  }

  async nextReturnNumber(tx: Prisma.TransactionClient, pharmacyId: string): Promise<string> {
    const year = new Date().getFullYear();
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${pharmacyId}:PRTN:${year}`}))`;
    const count = await tx.purchaseReturn.count({ where: { pharmacyId, returnNumber: { startsWith: `PRTN-${year}-` } } });
    return `PRTN-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  lockGrn(tx: Prisma.TransactionClient, grnId: string) {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`preturn:${grnId}`}))`;
  }

  create(tx: Prisma.TransactionClient, data: Prisma.PurchaseReturnUncheckedCreateInput) {
    return tx.purchaseReturn.create({ data });
  }

  detailById(pharmacyId: string, id: string) {
    return this.prisma.purchaseReturn.findFirst({ where: { id, pharmacyId }, include: { items: true } });
  }

  async list(pharmacyId: string, branchId: string | undefined, opts: { page: number; limit: number; search?: string; supplierId?: string; settlementStatus?: string; reasonCode?: string; dateFrom?: string; dateTo?: string; onlyPending?: boolean; sortBy?: string; sortOrder?: string }) {
    const where: Prisma.PurchaseReturnWhereInput = { pharmacyId };
    if (branchId) where.branchId = branchId;
    if (opts.supplierId) where.supplierId = opts.supplierId;
    if (opts.onlyPending) where.settlementStatus = 'PENDING';
    else if (opts.settlementStatus) where.settlementStatus = opts.settlementStatus as Prisma.PurchaseReturnWhereInput['settlementStatus'];
    if (opts.reasonCode) where.items = { some: { reasonCode: opts.reasonCode as Prisma.PurchaseReturnItemWhereInput['reasonCode'] } };
    if (opts.dateFrom || opts.dateTo) where.returnDate = { ...(opts.dateFrom ? { gte: new Date(opts.dateFrom) } : {}), ...(opts.dateTo ? { lte: new Date(opts.dateTo) } : {}) };
    if (opts.search) where.returnNumber = { contains: opts.search, mode: 'insensitive' };

    const sortBy = ['returnDate', 'returnNumber', 'expectedCreditAmount'].includes(opts.sortBy ?? '') ? opts.sortBy! : 'returnDate';
    const sortOrder = opts.sortOrder === 'asc' ? 'asc' : 'desc';
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.purchaseReturn.count({ where }),
      this.prisma.purchaseReturn.findMany({ where, orderBy: { [sortBy]: sortOrder }, skip: (opts.page - 1) * opts.limit, take: opts.limit, include: { _count: { select: { items: true } } } }),
    ]);
    return { total, rows };
  }
}
