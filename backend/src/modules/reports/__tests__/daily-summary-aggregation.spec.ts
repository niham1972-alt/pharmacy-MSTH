import { Prisma } from '@prisma/client';
import { DailySummaryAggregationJob } from '../jobs/daily-summary-aggregation.job';

/** In-memory prisma double whose upsert mimics the real (pharmacyId,branchId,date[,category])
 *  unique-key upsert — so a re-run overwrites rather than appends (the idempotency property). */
function makePrisma() {
  const salesStore = new Map<string, { totalRevenue: unknown; totalReturnsAmount: unknown; transactionCount: number }>();
  const expenseStore = new Map<string, { totalAmount: unknown }>();

  const prisma = {
    sale: {
      groupBy: jest.fn(async () => [
        { pharmacyId: 'ph-1', branchId: 'br-1', _sum: { grandTotal: new Prisma.Decimal(10000), totalCost: new Prisma.Decimal(6000), taxTotal: new Prisma.Decimal(800) }, _count: { _all: 12 } },
      ]),
    },
    salesReturn: {
      groupBy: jest.fn(async () => [
        { pharmacyId: 'ph-1', branchId: 'br-1', _sum: { totalRefundAmount: new Prisma.Decimal(500) } },
      ]),
    },
    expense: {
      groupBy: jest.fn(async () => [
        { pharmacyId: 'ph-1', branchId: 'br-1', categoryId: 'cat-rent', _sum: { amount: new Prisma.Decimal(20000) } },
      ]),
    },
    dailySalesSummary: {
      upsert: jest.fn(async ({ where, create, update }: { where: { pharmacyId_branchId_date: { pharmacyId: string; branchId: string; date: Date } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const k = `${where.pharmacyId_branchId_date.pharmacyId}|${where.pharmacyId_branchId_date.branchId}|${where.pharmacyId_branchId_date.date.toISOString()}`;
        salesStore.set(k, (salesStore.has(k) ? { ...create, ...update } : create) as never); // upsert overwrites
      }),
    },
    dailyExpenseSummary: {
      upsert: jest.fn(async ({ where, create, update }: { where: { pharmacyId_branchId_date_categoryId: { pharmacyId: string; branchId: string; date: Date; categoryId: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const w = where.pharmacyId_branchId_date_categoryId;
        const k = `${w.pharmacyId}|${w.branchId}|${w.date.toISOString()}|${w.categoryId}`;
        expenseStore.set(k, (expenseStore.has(k) ? { ...create, ...update } : create) as never);
      }),
    },
  };
  return { prisma, salesStore, expenseStore };
}

describe('DailySummaryAggregationJob idempotency (spec §8/§20/§21)', () => {
  const day = new Date('2026-07-15T00:00:00.000Z');

  it('produces one summary row per branch/category with the correct totals', async () => {
    const { prisma, salesStore, expenseStore } = makePrisma();
    const job = new DailySummaryAggregationJob(prisma as never);
    await job.aggregateDay(day);
    expect(salesStore.size).toBe(1);
    expect(expenseStore.size).toBe(1);
    const sales = [...salesStore.values()][0];
    expect(sales.totalRevenue).toBe(10000);
    expect(sales.totalReturnsAmount).toBe(500);
    expect(sales.transactionCount).toBe(12);
    expect([...expenseStore.values()][0].totalAmount).toBe(20000);
  });

  it('re-running for the same day does NOT double-count (upsert, not append)', async () => {
    const { prisma, salesStore, expenseStore } = makePrisma();
    const job = new DailySummaryAggregationJob(prisma as never);
    await job.aggregateDay(day);
    await job.aggregateDay(day); // second run — same date
    expect(salesStore.size).toBe(1); // still exactly one row, not two
    expect(expenseStore.size).toBe(1);
    expect([...salesStore.values()][0].totalRevenue).toBe(10000); // unchanged, not 20000
    // upsert (not create) is the mechanism — called twice for the same key.
    expect(prisma.dailySalesSummary.upsert).toHaveBeenCalledTimes(2);
  });

  it('run() scans a trailing catch-up window up to yesterday', async () => {
    const { prisma } = makePrisma();
    const job = new DailySummaryAggregationJob(prisma as never);
    const r = await job.run(new Date('2026-07-21T10:00:00Z'), 5);
    expect(r.daysProcessed).toBe(5); // 5-day catch-up window
    expect(prisma.sale.groupBy).toHaveBeenCalledTimes(5);
  });
});
