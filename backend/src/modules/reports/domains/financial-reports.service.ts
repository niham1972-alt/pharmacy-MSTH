import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { ResolvedRange, splitAggregatedVsLive } from '../date-range.util';
import { assembleProfitLoss, PnlStatement } from '../pnl.util';
import { TabularReport } from '../interfaces/report-filters.interface';

const dec = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : typeof v === 'number' ? v : v.toNumber());
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Financial reports — P&L, Tax/VAT summary, Accounts Payable (spec §2.1).
 *
 * HYBRID READ STRATEGY (spec §8/§18): for the portion of the range already
 * covered by the nightly DailySalesSummary/DailyExpenseSummary, totals come from
 * those pre-aggregated rows; the recent, not-yet-aggregated tail is computed live
 * from Module 4/13's source tables. The two portions are disjoint and exhaustive,
 * so the result reconciles EXACTLY against a pure live computation of the same range.
 */
@Injectable()
export class FinancialReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveBranches(user: AuthenticatedUser, branchId?: string): string[] {
    if (branchId) {
      if (!user.accessibleBranchIds.includes(branchId)) return [];
      return [branchId];
    }
    return user.accessibleBranchIds;
  }

  /** The last UTC day the aggregation job has completed for these branches. */
  private async aggregatedThrough(pharmacyId: string, branches: string[]): Promise<Date | null> {
    const row = await this.prisma.dailySalesSummary.findFirst({
      where: { pharmacyId, branchId: { in: branches } },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    return row?.date ?? null;
  }

  // --- Profit & Loss -------------------------------------------------------
  async profitLoss(user: AuthenticatedUser, range: ResolvedRange, branchId?: string): Promise<PnlStatement & { dateFrom: string; dateTo: string }> {
    const branches = this.resolveBranches(user, branchId);
    if (branches.length === 0) return { ...assembleProfitLoss(EMPTY), dateFrom: range.from.toISOString(), dateTo: range.to.toISOString() };

    const through = await this.aggregatedThrough(user.pharmacyId, branches);
    const { summary, live } = splitAggregatedVsLive(range, through);

    let grossRevenue = 0, returnsAmount = 0, costOfGoodsSold = 0, taxCollected = 0;
    const expenseByCat = new Map<string, number>();

    if (summary) {
      const s = await this.prisma.dailySalesSummary.aggregate({
        where: { pharmacyId: user.pharmacyId, branchId: { in: branches }, date: { gte: summary.from, lte: summary.to } },
        _sum: { totalRevenue: true, totalCost: true, totalTax: true, totalReturnsAmount: true },
      });
      grossRevenue += dec(s._sum.totalRevenue); costOfGoodsSold += dec(s._sum.totalCost);
      taxCollected += dec(s._sum.totalTax); returnsAmount += dec(s._sum.totalReturnsAmount);
      const es = await this.prisma.dailyExpenseSummary.groupBy({
        by: ['categoryId'], where: { pharmacyId: user.pharmacyId, branchId: { in: branches }, date: { gte: summary.from, lte: summary.to } }, _sum: { totalAmount: true },
      });
      for (const e of es) expenseByCat.set(e.categoryId, (expenseByCat.get(e.categoryId) ?? 0) + dec(e._sum.totalAmount));
    }

    if (live) {
      const liveTotals = await this.liveSalesTotals(user.pharmacyId, branches, live);
      grossRevenue += liveTotals.grossRevenue; costOfGoodsSold += liveTotals.costOfGoodsSold;
      taxCollected += liveTotals.taxCollected; returnsAmount += liveTotals.returnsAmount;
      const le = await this.prisma.expense.groupBy({
        by: ['categoryId'], where: { pharmacyId: user.pharmacyId, branchId: { in: branches }, incurredDate: { gte: live.from, lte: live.to }, approvalStatus: { in: ['APPROVED', 'NOT_REQUIRED'] } }, _sum: { amount: true },
      });
      for (const e of le) expenseByCat.set(e.categoryId, (expenseByCat.get(e.categoryId) ?? 0) + dec(e._sum.amount));
    }

    // Pending expenses (informational, whole range) — never in the summary tables.
    const pending = await this.prisma.expense.aggregate({
      where: { pharmacyId: user.pharmacyId, branchId: { in: branches }, incurredDate: { gte: range.from, lte: range.to }, approvalStatus: 'PENDING_APPROVAL' }, _sum: { amount: true },
    });

    const catNames = await this.categoryNames(user.pharmacyId, [...expenseByCat.keys()]);
    const expensesByCategory = [...expenseByCat.entries()].map(([categoryId, amount]) => ({ categoryId, categoryName: catNames.get(categoryId) ?? categoryId, amount }));

    const pnl = assembleProfitLoss({ grossRevenue, returnsAmount, costOfGoodsSold, taxCollected, expensesByCategory, pendingExpensesAmount: dec(pending._sum.amount) });
    return { ...pnl, dateFrom: range.from.toISOString(), dateTo: range.to.toISOString() };
  }

  /** Live revenue/cost/tax/returns for a (recent) range straight from source tables. */
  private async liveSalesTotals(pharmacyId: string, branches: string[], range: ResolvedRange) {
    const sale = await this.prisma.sale.aggregate({
      where: { pharmacyId, branchId: { in: branches }, status: 'COMPLETED', saleDate: { gte: range.from, lte: range.to } },
      _sum: { grandTotal: true, totalCost: true, taxTotal: true },
    });
    const ret = await this.prisma.salesReturn.aggregate({
      where: { pharmacyId, branchId: { in: branches }, returnDate: { gte: range.from, lte: range.to } }, _sum: { totalRefundAmount: true },
    });
    return {
      grossRevenue: dec(sale._sum.grandTotal), costOfGoodsSold: dec(sale._sum.totalCost),
      taxCollected: dec(sale._sum.taxTotal), returnsAmount: dec(ret._sum.totalRefundAmount),
    };
  }

  private async categoryNames(pharmacyId: string, ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const cats = await this.prisma.expenseCategory.findMany({ where: { pharmacyId, id: { in: ids } }, select: { id: true, name: true } });
    return new Map(cats.map((c) => [c.id, c.name]));
  }

  // --- Tax / VAT summary ---------------------------------------------------
  async taxSummary(user: AuthenticatedUser, range: ResolvedRange, branchId?: string): Promise<TabularReport> {
    const branches = this.resolveBranches(user, branchId);
    const pnl = branches.length ? await this.profitLoss(user, range, branchId) : null;
    const taxCollected = pnl?.taxCollected ?? 0;
    // Tax paid on purchases — PO tax total for POs raised in the period (documented approximation).
    const po = await this.prisma.purchaseOrder.aggregate({
      where: { pharmacyId: user.pharmacyId, branchId: { in: branches }, createdAt: { gte: range.from, lte: range.to } }, _sum: { taxTotal: true },
    });
    const taxPaid = round2(dec(po._sum.taxTotal));
    const net = round2(taxCollected - taxPaid);
    return {
      columns: [{ key: 'line', label: 'Line' }, { key: 'amount', label: 'Amount', numeric: true }],
      rows: [
        { line: 'Output tax (collected on sales)', amount: taxCollected },
        { line: 'Input tax (paid on purchases)', amount: taxPaid },
        { line: 'Net tax liability', amount: net },
      ],
      summary: { taxCollected, taxPaid, netTaxLiability: net },
      meta: { dateFrom: range.from.toISOString(), dateTo: range.to.toISOString() },
    };
  }

  // --- Accounts Payable (point-in-time) ------------------------------------
  async accountsPayable(user: AuthenticatedUser, branchId?: string): Promise<TabularReport> {
    const branches = this.resolveBranches(user, branchId);
    const now = Date.now();
    const expenses = await this.prisma.expense.findMany({
      where: { pharmacyId: user.pharmacyId, branchId: { in: branches }, paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] }, approvalStatus: { not: 'REJECTED' } },
      include: { category: { select: { name: true } } },
    });
    const pos = await this.prisma.purchaseOrder.findMany({
      where: { pharmacyId: user.pharmacyId, branchId: { in: branches }, paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] }, status: { notIn: ['DRAFT', 'CANCELLED', 'REJECTED'] } },
      include: { supplier: { select: { companyName: true } } },
    });
    const rows = [
      ...expenses.map((e) => ({ source: 'Expense', reference: e.expenseNumber, party: e.payeeName, type: e.category?.name ?? 'Expense', outstanding: round2(dec(e.amount) - dec(e.amountPaid)), dueDate: e.dueDate?.toISOString().slice(0, 10) ?? null, overdue: e.dueDate && e.dueDate.getTime() < now ? 'Yes' : 'No' })),
      ...pos.map((p) => ({ source: 'Purchase Order', reference: p.poNumber, party: p.supplier?.companyName ?? 'Supplier', type: 'Purchase Order', outstanding: round2(dec(p.grandTotal) - dec(p.amountPaid)), dueDate: p.dueDate?.toISOString().slice(0, 10) ?? null, overdue: p.dueDate && p.dueDate.getTime() < now ? 'Yes' : 'No' })),
    ].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
    return {
      columns: [
        { key: 'source', label: 'Source' }, { key: 'reference', label: 'Reference' }, { key: 'party', label: 'Party' },
        { key: 'type', label: 'Type' }, { key: 'outstanding', label: 'Outstanding', numeric: true }, { key: 'dueDate', label: 'Due date' }, { key: 'overdue', label: 'Overdue' },
      ],
      rows,
      summary: { count: rows.length, totalOutstanding: round2(rows.reduce((s, r) => s + (r.outstanding as number), 0)) },
    };
  }
}

const EMPTY = { grossRevenue: 0, returnsAmount: 0, costOfGoodsSold: 0, taxCollected: 0, expensesByCategory: [] };
