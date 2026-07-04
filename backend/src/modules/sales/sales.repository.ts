import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Race-safe SL-YYYY-NNNNNN (advisory lock, mirrors Module 3). */
  async nextSaleNumber(tx: Prisma.TransactionClient, pharmacyId: string): Promise<string> {
    const year = new Date().getFullYear();
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${pharmacyId}:SL:${year}`}))`;
    const count = await tx.sale.count({ where: { pharmacyId, saleNumber: { startsWith: `SL-${year}-` } } });
    return `SL-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  currentOpenSession(pharmacyId: string, branchId: string, cashierId: string) {
    return this.prisma.cashierSession.findFirst({ where: { pharmacyId, branchId, cashierId, status: 'OPEN' }, orderBy: { openedAt: 'desc' } });
  }

  sessionById(pharmacyId: string, id: string) {
    return this.prisma.cashierSession.findFirst({ where: { id, pharmacyId } });
  }

  listSessions(pharmacyId: string, branchId: string, cashierId?: string) {
    return this.prisma.cashierSession.findMany({
      where: { pharmacyId, branchId, ...(cashierId ? { cashierId } : {}) },
      orderBy: { openedAt: 'desc' },
      take: 50,
    });
  }

  async sessionTotals(sessionId: string) {
    const [sales, cashPayments] = await Promise.all([
      this.prisma.sale.aggregate({ where: { cashierSessionId: sessionId, status: 'COMPLETED' }, _sum: { grandTotal: true }, _count: { _all: true } }),
      this.prisma.salePayment.aggregate({ where: { method: 'CASH', sale: { cashierSessionId: sessionId, status: 'COMPLETED' } }, _sum: { amount: true } }),
    ]);
    const byMethod = await this.prisma.salePayment.groupBy({ by: ['method'], where: { sale: { cashierSessionId: sessionId, status: 'COMPLETED' } }, _sum: { amount: true } });
    return { sales, cashPayments, byMethod };
  }

  findSaleForIdempotency(pharmacyId: string, key: string) {
    return this.prisma.sale.findFirst({ where: { pharmacyId, idempotencyKey: key } });
  }

  saleById(pharmacyId: string, id: string) {
    return this.prisma.sale.findFirst({
      where: { id, pharmacyId },
      include: { items: true, payments: true, complianceRecords: true },
    });
  }

  async listSales(pharmacyId: string, branchId: string, q: {
    page: number; limit: number; search?: string; cashierId?: string; customerId?: string; status?: string; paymentMethod?: string; dateFrom?: string; dateTo?: string;
  }) {
    const where: Prisma.SaleWhereInput = { pharmacyId, branchId };
    if (q.cashierId) where.cashierId = q.cashierId;
    if (q.customerId) where.customerId = q.customerId;
    if (q.status) where.status = q.status as Prisma.SaleWhereInput['status'];
    if (q.search) where.saleNumber = { contains: q.search, mode: 'insensitive' };
    if (q.paymentMethod) where.payments = { some: { method: q.paymentMethod } };
    if (q.dateFrom || q.dateTo) where.saleDate = { ...(q.dateFrom ? { gte: new Date(q.dateFrom) } : {}), ...(q.dateTo ? { lte: new Date(q.dateTo) } : {}) };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        orderBy: { saleDate: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { payments: { select: { method: true } }, _count: { select: { items: true } } },
      }),
    ]);
    return { total, rows };
  }

  parkedSales(pharmacyId: string, branchId: string, cashierId: string) {
    return this.prisma.parkedSale.findMany({ where: { pharmacyId, branchId, cashierId }, orderBy: { createdAt: 'desc' } });
  }
}
