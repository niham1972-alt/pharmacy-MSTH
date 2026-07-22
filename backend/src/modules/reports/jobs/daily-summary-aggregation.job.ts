import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { DAY_MS, endOfUtcDay, startOfUtcDay } from '../date-range.util';

const dec = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : typeof v === 'number' ? v : v.toNumber());
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface AggregationResult {
  daysProcessed: number;
  salesRowsUpserted: number;
  expenseRowsUpserted: number;
}

/**
 * Module 14 nightly pre-aggregation (spec §6 / §8 / §18 / §21).
 *
 * Populates DailySalesSummary + DailyExpenseSummary — pre-aggregated read models
 * that report queries use for older periods, so a P&L over a year doesn't re-scan
 * raw `Sale`/`SaleItem` every time.
 *
 * IDEMPOTENT: every day is written via `upsert` on the (pharmacyId, branchId, date
 * [, categoryId]) unique key, recomputed from live source data. Re-running for a
 * day never double-counts — it overwrites with the freshly-computed total.
 *
 * CATCH-UP (spec §21): each run re-aggregates a trailing window (default 35 days)
 * up to yesterday, so a night the job didn't run is automatically backfilled on
 * the next successful run — no silent hole in the aggregates.
 */
@Injectable()
export class DailySummaryAggregationJob implements OnModuleInit {
  private readonly logger = new Logger('DailySummaryAggregation');
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.REPORTS_AGGREGATION_ENABLED === 'false') return;
    setTimeout(() => void this.tick(), 45_000).unref?.();
    this.timer = setInterval(() => void this.tick(), DAY_MS);
    this.timer.unref?.();
  }

  private async tick(): Promise<void> {
    try {
      const r = await this.run();
      this.logger.log(`Nightly aggregation: ${r.daysProcessed} day(s), ${r.salesRowsUpserted} sales + ${r.expenseRowsUpserted} expense summary rows.`);
    } catch (err) {
      this.logger.error(`Nightly aggregation failed: ${(err as Error).message}`);
    }
  }

  /** Aggregate the trailing `lookbackDays` up to yesterday (inclusive). Today is
   *  intentionally left to live queries until it's complete. */
  async run(asOf: Date = new Date(), lookbackDays = 35): Promise<AggregationResult> {
    const yesterday = startOfUtcDay(new Date(asOf.getTime() - DAY_MS));
    const result: AggregationResult = { daysProcessed: 0, salesRowsUpserted: 0, expenseRowsUpserted: 0 };
    for (let i = 0; i < lookbackDays; i++) {
      const day = new Date(yesterday.getTime() - i * DAY_MS);
      const r = await this.aggregateDay(day);
      result.daysProcessed++;
      result.salesRowsUpserted += r.sales;
      result.expenseRowsUpserted += r.expenses;
    }
    return result;
  }

  /** Compute + upsert both summaries for a single UTC day. Public for tests. */
  async aggregateDay(day: Date): Promise<{ sales: number; expenses: number }> {
    const dayStart = startOfUtcDay(day);
    const dayEnd = endOfUtcDay(day);

    // --- Sales side: revenue/cost/tax/count per branch, plus returns. --------
    const sales = await this.prisma.sale.groupBy({
      by: ['pharmacyId', 'branchId'],
      where: { status: 'COMPLETED', saleDate: { gte: dayStart, lte: dayEnd } },
      _sum: { grandTotal: true, totalCost: true, taxTotal: true },
      _count: { _all: true },
    });
    const returns = await this.prisma.salesReturn.groupBy({
      by: ['pharmacyId', 'branchId'],
      where: { returnDate: { gte: dayStart, lte: dayEnd } },
      _sum: { totalRefundAmount: true },
    });
    const returnsBy = new Map(returns.map((r) => [`${r.pharmacyId}|${r.branchId}`, dec(r._sum.totalRefundAmount)]));

    // Union of branches that had sales OR returns that day.
    const salesKeys = new Map(sales.map((s) => [`${s.pharmacyId}|${s.branchId}`, s]));
    const allKeys = new Set<string>([...salesKeys.keys(), ...returnsBy.keys()]);
    let salesRows = 0;
    for (const key of allKeys) {
      const [pharmacyId, branchId] = key.split('|');
      const s = salesKeys.get(key);
      await this.prisma.dailySalesSummary.upsert({
        where: { pharmacyId_branchId_date: { pharmacyId, branchId, date: dayStart } },
        create: {
          pharmacyId, branchId, date: dayStart,
          totalRevenue: round2(dec(s?._sum.grandTotal)), totalCost: round2(dec(s?._sum.totalCost)),
          totalTax: round2(dec(s?._sum.taxTotal)), transactionCount: s?._count._all ?? 0,
          totalReturnsAmount: round2(returnsBy.get(key) ?? 0),
        },
        update: {
          totalRevenue: round2(dec(s?._sum.grandTotal)), totalCost: round2(dec(s?._sum.totalCost)),
          totalTax: round2(dec(s?._sum.taxTotal)), transactionCount: s?._count._all ?? 0,
          totalReturnsAmount: round2(returnsBy.get(key) ?? 0),
        },
      });
      salesRows++;
    }

    // --- Expense side: per branch + category. Only ACTUAL (approved / not-
    // required) expenses are pre-aggregated — PENDING_APPROVAL ones aren't a
    // confirmed cost yet (spec §21), so the P&L reads them live & separately.
    const expenses = await this.prisma.expense.groupBy({
      by: ['pharmacyId', 'branchId', 'categoryId'],
      where: { incurredDate: { gte: dayStart, lte: dayEnd }, approvalStatus: { in: ['APPROVED', 'NOT_REQUIRED'] } },
      _sum: { amount: true },
    });
    let expenseRows = 0;
    for (const e of expenses) {
      await this.prisma.dailyExpenseSummary.upsert({
        where: { pharmacyId_branchId_date_categoryId: { pharmacyId: e.pharmacyId, branchId: e.branchId, date: dayStart, categoryId: e.categoryId } },
        create: { pharmacyId: e.pharmacyId, branchId: e.branchId, date: dayStart, categoryId: e.categoryId, totalAmount: round2(dec(e._sum.amount)) },
        update: { totalAmount: round2(dec(e._sum.amount)) },
      });
      expenseRows++;
    }
    return { sales: salesRows, expenses: expenseRows };
  }
}
