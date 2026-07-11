import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** All Prisma access for Module 10 lives here — the service stays pure logic. */
@Injectable()
export class SalesReturnsRepository {
  constructor(private readonly prisma: PrismaService) {}

  saleWithItems(pharmacyId: string, saleId: string) {
    return this.prisma.sale.findFirst({
      where: { id: saleId, pharmacyId },
      include: { items: true },
    });
  }

  /** Sum of already-returned quantity per original SaleItem, across every prior return.
   *  A single grouped query — never N+1 (spec §18). Accepts an optional tx for the
   *  authoritative in-transaction re-check. */
  async returnedQtyByLine(pharmacyId: string, saleId: string, tx?: Prisma.TransactionClient): Promise<Map<string, number>> {
    const client = tx ?? this.prisma;
    const rows = await client.salesReturnItem.groupBy({
      by: ['originalSaleItemId'],
      where: { salesReturn: { pharmacyId, originalSaleId: saleId } },
      _sum: { quantityReturned: true },
    });
    return new Map(rows.map((r) => [r.originalSaleItemId, r._sum.quantityReturned ?? 0]));
  }

  medicinesWithCategory(pharmacyId: string, ids: string[]) {
    return this.prisma.medicine.findMany({
      where: { pharmacyId, id: { in: ids } },
      select: { id: true, genericName: true, brandName: true, sku: true, prescriptionRequired: true, controlledSubstanceSchedule: true, categoryId: true, category: { select: { name: true } } },
    });
  }

  async nextReturnNumber(tx: Prisma.TransactionClient, pharmacyId: string): Promise<string> {
    const year = new Date().getFullYear();
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${pharmacyId}:RTN:${year}`}))`;
    const count = await tx.salesReturn.count({ where: { pharmacyId, returnNumber: { startsWith: `RTN-${year}-` } } });
    return `RTN-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  /** Serialize concurrent returns against the SAME sale so two cashiers can't both
   *  slip past the remaining-quantity check. */
  lockSale(tx: Prisma.TransactionClient, saleId: string) {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`return:${saleId}`}))`;
  }

  async list(pharmacyId: string, branchId: string | undefined, opts: { page: number; limit: number; search?: string; customerId?: string; cashierId?: string; reasonCode?: string; refundMethod?: string; dateFrom?: string; dateTo?: string; sortBy?: string; sortOrder?: string }) {
    const where: Prisma.SalesReturnWhereInput = { pharmacyId };
    if (branchId) where.branchId = branchId;
    if (opts.customerId) where.customerId = opts.customerId;
    if (opts.cashierId) where.processedBy = opts.cashierId;
    if (opts.refundMethod) where.refundMethod = opts.refundMethod as Prisma.SalesReturnWhereInput['refundMethod'];
    if (opts.reasonCode) where.items = { some: { reasonCode: opts.reasonCode as Prisma.SalesReturnItemWhereInput['reasonCode'] } };
    if (opts.dateFrom || opts.dateTo) where.returnDate = { ...(opts.dateFrom ? { gte: new Date(opts.dateFrom) } : {}), ...(opts.dateTo ? { lte: new Date(opts.dateTo) } : {}) };
    if (opts.search) where.returnNumber = { contains: opts.search, mode: 'insensitive' };

    const sortBy = ['returnDate', 'returnNumber', 'totalRefundAmount'].includes(opts.sortBy ?? '') ? opts.sortBy! : 'returnDate';
    const sortOrder = opts.sortOrder === 'asc' ? 'asc' : 'desc';
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.salesReturn.count({ where }),
      this.prisma.salesReturn.findMany({ where, orderBy: { [sortBy]: sortOrder }, skip: (opts.page - 1) * opts.limit, take: opts.limit, include: { _count: { select: { items: true } } } }),
    ]);
    return { total, rows };
  }

  detailById(pharmacyId: string, id: string) {
    return this.prisma.salesReturn.findFirst({ where: { id, pharmacyId }, include: { items: true } });
  }

  create(tx: Prisma.TransactionClient, data: Prisma.SalesReturnUncheckedCreateInput) {
    return tx.salesReturn.create({ data });
  }
}
