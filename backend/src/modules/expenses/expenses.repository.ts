import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryExpensesDto } from './dto/query-expenses.dto';

@Injectable()
export class ExpensesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Race-safe EXP-YYYY-NNNNNN numbering (pg advisory lock per pharmacy+year),
   *  mirroring the PO/GRN/ADJ numbering pattern. */
  async nextNumber(tx: Prisma.TransactionClient, pharmacyId: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${pharmacyId}:EXP:${year}`}))`;
    const count = await tx.expense.count({ where: { pharmacyId, expenseNumber: { startsWith: `EXP-${year}-` } } });
    return `EXP-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  findById(pharmacyId: string, id: string) {
    return this.prisma.expense.findFirst({ where: { id, pharmacyId }, include: { category: true } });
  }

  async list(pharmacyId: string, q: QueryExpensesDto, accessibleBranchIds: string[]) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const recurringFilter =
      q.isRecurringGenerated === 'true'
        ? { generatedFromTemplateId: { not: null } }
        : q.isRecurringGenerated === 'false'
          ? { generatedFromTemplateId: null }
          : {};
    const where: Prisma.ExpenseWhereInput = {
      pharmacyId,
      // Never leak an expense from a branch the caller can't see.
      branchId: q.branchId ? q.branchId : { in: accessibleBranchIds },
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.paymentStatus ? { paymentStatus: q.paymentStatus } : {}),
      ...(q.approvalStatus ? { approvalStatus: q.approvalStatus } : {}),
      ...recurringFilter,
      ...(q.search
        ? { OR: [{ payeeName: { contains: q.search, mode: 'insensitive' } }, { notes: { contains: q.search, mode: 'insensitive' } }, { expenseNumber: { contains: q.search, mode: 'insensitive' } }] }
        : {}),
      ...(q.dateFrom || q.dateTo
        ? { incurredDate: { ...(q.dateFrom ? { gte: new Date(q.dateFrom) } : {}), ...(q.dateTo ? { lte: new Date(q.dateTo) } : {}) } }
        : {}),
    };
    const sortable = new Set(['incurredDate', 'dueDate', 'amount', 'createdAt', 'expenseNumber']);
    const sortBy = sortable.has(q.sortBy ?? '') ? (q.sortBy as string) : 'incurredDate';
    const orderBy: Prisma.ExpenseOrderByWithRelationInput = { [sortBy]: q.sortOrder === 'asc' ? 'asc' : 'desc' };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({ where, include: { category: true }, orderBy, skip: (page - 1) * limit, take: limit }),
    ]);
    return { total, rows, page, limit };
  }

  /** Category breakdown for a period (feeds Dashboard's Total Expenses + Reports). */
  async summary(pharmacyId: string, from: Date, to: Date, branchId?: string) {
    const grouped = await this.prisma.expense.groupBy({
      by: ['categoryId'],
      where: { pharmacyId, incurredDate: { gte: from, lte: to }, approvalStatus: { not: 'REJECTED' }, ...(branchId ? { branchId } : {}) },
      _sum: { amount: true },
      _count: { _all: true },
    });
    return grouped;
  }

  /** Unpaid / partially-paid, non-rejected expenses for the consolidated payables view. */
  outstandingExpenses(pharmacyId: string, accessibleBranchIds: string[], branchId?: string) {
    return this.prisma.expense.findMany({
      where: {
        pharmacyId,
        branchId: branchId ? branchId : { in: accessibleBranchIds },
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        approvalStatus: { not: 'REJECTED' },
      },
      include: { category: true },
    });
  }
}
