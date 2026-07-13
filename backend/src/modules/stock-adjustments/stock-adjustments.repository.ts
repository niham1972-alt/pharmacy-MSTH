import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryAdjustmentsDto } from './dto/stock-adjustment.dto';

@Injectable()
export class StockAdjustmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Race-safe ADJ-YYYY-NNNNNN numbering (pg advisory lock per pharmacy+year). */
  async nextNumber(tx: Prisma.TransactionClient, pharmacyId: string): Promise<string> {
    const year = new Date().getFullYear();
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${pharmacyId}:ADJ:${year}`}))`;
    const count = await tx.stockAdjustment.count({ where: { pharmacyId, adjustmentNumber: { startsWith: `ADJ-${year}-` } } });
    return `ADJ-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  findById(pharmacyId: string, id: string) {
    return this.prisma.stockAdjustment.findFirst({ where: { id, pharmacyId } });
  }

  async list(pharmacyId: string, q: QueryAdjustmentsDto, branchId?: string) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const where: Prisma.StockAdjustmentWhereInput = {
      pharmacyId,
      ...(branchId ? { branchId } : q.branchId ? { branchId: q.branchId } : {}),
      ...(q.medicineId ? { medicineId: q.medicineId } : {}),
      ...(q.reasonCode ? { reasonCode: q.reasonCode } : {}),
      ...(q.direction ? { direction: q.direction } : {}),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.search ? { OR: [{ adjustmentNumber: { contains: q.search, mode: 'insensitive' } }, { reasonNote: { contains: q.search, mode: 'insensitive' } }] } : {}),
      ...(q.dateFrom || q.dateTo
        ? { requestedAt: { ...(q.dateFrom ? { gte: new Date(q.dateFrom) } : {}), ...(q.dateTo ? { lte: new Date(q.dateTo) } : {}) } }
        : {}),
    };
    const orderBy: Prisma.StockAdjustmentOrderByWithRelationInput = { [q.sortBy || 'requestedAt']: q.sortOrder === 'asc' ? 'asc' : 'desc' } as never;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.stockAdjustment.count({ where }),
      this.prisma.stockAdjustment.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
    ]);
    return { total, rows, page, limit };
  }

  pending(pharmacyId: string, branchId?: string) {
    return this.prisma.stockAdjustment.findMany({
      where: { pharmacyId, status: 'PENDING_APPROVAL', ...(branchId ? { branchId } : {}) },
      orderBy: { requestedAt: 'asc' },
    });
  }

  /** Negative-adjustment shrinkage aggregates for a period. */
  async shrinkage(pharmacyId: string, dateFrom?: string, dateTo?: string, branchId?: string) {
    const where: Prisma.StockAdjustmentWhereInput = {
      pharmacyId,
      direction: 'DECREASE',
      status: { in: ['AUTO_APPROVED', 'APPROVED'] },
      ...(branchId ? { branchId } : {}),
      ...(dateFrom || dateTo ? { requestedAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } } : {}),
    };
    return this.prisma.stockAdjustment.findMany({ where, select: { medicineId: true, quantity: true, reasonCode: true, unitCostAtRequest: true, requestedBy: true } });
  }
}
