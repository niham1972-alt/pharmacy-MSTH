import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ExpensesRepository } from './expenses.repository';
import { ConsolidatedPayableRow } from './interfaces/expense.interface';

const dec = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : typeof v === 'number' ? v : v.toNumber());
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Module 13 Consolidated Accounts Payable (spec §2.5 / §11 / §24).
 *
 * A READ-ONLY aggregation that presents this module's outstanding expenses
 * ALONGSIDE Module 3's outstanding purchase-order payables in one due-date-sorted
 * list. It never writes to or duplicates Module 3's tables — resolving a PO
 * payable still happens in the Purchases module's own payment flow. This mirrors
 * the cross-module read-for-reporting pattern of Module 7's supplier-performance view.
 */
@Injectable()
export class PayablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ExpensesRepository,
  ) {}

  async getConsolidated(user: AuthenticatedUser, branchId?: string): Promise<{ rows: ConsolidatedPayableRow[]; totals: { count: number; totalOutstanding: number; overdueOutstanding: number; expenseOutstanding: number; purchaseOrderOutstanding: number } }> {
    if (branchId && !user.accessibleBranchIds.includes(branchId)) {
      return { rows: [], totals: { count: 0, totalOutstanding: 0, overdueOutstanding: 0, expenseOutstanding: 0, purchaseOrderOutstanding: 0 } };
    }
    const branches = branchId ? [branchId] : user.accessibleBranchIds;
    const now = Date.now();

    // This module's own outstanding expenses.
    const expenses = await this.repo.outstandingExpenses(user.pharmacyId, user.accessibleBranchIds, branchId);
    const expenseRows: ConsolidatedPayableRow[] = expenses.map((e) => {
      const outstanding = round2(dec(e.amount) - dec(e.amountPaid));
      return {
        source: 'EXPENSE',
        id: e.id,
        reference: e.expenseNumber,
        party: e.payeeName,
        categoryOrType: e.category?.name ?? 'Expense',
        amount: dec(e.amount),
        amountPaid: dec(e.amountPaid),
        outstanding,
        dueDate: e.dueDate?.toISOString() ?? null,
        isOverdue: !!e.dueDate && e.dueDate.getTime() < now,
        status: e.approvalStatus === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : e.paymentStatus,
      };
    });

    // Module 3's outstanding PO payables (READ-ONLY). Only received/approved POs
    // that still owe money — draft/cancelled/rejected POs aren't payables.
    const pos = await this.prisma.purchaseOrder.findMany({
      where: {
        pharmacyId: user.pharmacyId,
        branchId: { in: branches },
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        status: { notIn: ['DRAFT', 'CANCELLED', 'REJECTED'] },
      },
      include: { supplier: { select: { companyName: true } } },
    });
    const poRows: ConsolidatedPayableRow[] = pos.map((p) => {
      const outstanding = round2(dec(p.grandTotal) - dec(p.amountPaid));
      return {
        source: 'PURCHASE_ORDER',
        id: p.id,
        reference: p.poNumber,
        party: p.supplier?.companyName ?? 'Supplier',
        categoryOrType: 'Purchase Order',
        amount: dec(p.grandTotal),
        amountPaid: dec(p.amountPaid),
        outstanding,
        dueDate: p.dueDate?.toISOString() ?? null,
        isOverdue: !!p.dueDate && p.dueDate.getTime() < now,
        status: p.paymentStatus,
      };
    });

    // Merge + sort by due date ascending (undated rows last).
    const rows = [...expenseRows, ...poRows].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

    const totals = {
      count: rows.length,
      totalOutstanding: round2(rows.reduce((s, r) => s + r.outstanding, 0)),
      overdueOutstanding: round2(rows.filter((r) => r.isOverdue).reduce((s, r) => s + r.outstanding, 0)),
      expenseOutstanding: round2(expenseRows.reduce((s, r) => s + r.outstanding, 0)),
      purchaseOrderOutstanding: round2(poRows.reduce((s, r) => s + r.outstanding, 0)),
    };
    return { rows, totals };
  }
}
