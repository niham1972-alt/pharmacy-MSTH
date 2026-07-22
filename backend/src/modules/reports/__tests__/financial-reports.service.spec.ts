import { Prisma } from '@prisma/client';
import { FinancialReportsService } from '../domains/financial-reports.service';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';

const D = (n: number) => new Prisma.Decimal(n);
const user: AuthenticatedUser = { userId: 'u1', role: 'admin', pharmacyId: 'ph-1', branchId: 'br-1', accessibleBranchIds: ['br-1'] };
const range = { from: new Date('2026-07-01T00:00:00.000Z'), to: new Date('2026-07-21T23:59:59.999Z') };

/**
 * Mock prisma so the range splits across pre-aggregated (through the 15th) and
 * live (16th–21st) portions — the P&L must reconcile against the manual sum of
 * both, proving the hybrid strategy doesn't drop or double-count anything.
 */
function makePrisma() {
  return {
    dailySalesSummary: {
      findFirst: jest.fn(async () => ({ date: new Date('2026-07-15T00:00:00.000Z') })), // aggregatedThrough
      aggregate: jest.fn(async () => ({ _sum: { totalRevenue: D(50000), totalCost: D(30000), totalTax: D(4000), totalReturnsAmount: D(2000) } })),
    },
    dailyExpenseSummary: { groupBy: jest.fn(async () => [{ categoryId: 'c1', _sum: { totalAmount: D(10000) } }]) },
    sale: { aggregate: jest.fn(async () => ({ _sum: { grandTotal: D(20000), totalCost: D(12000), taxTotal: D(1600) } })) },
    salesReturn: { aggregate: jest.fn(async () => ({ _sum: { totalRefundAmount: D(1000) } })) },
    expense: {
      groupBy: jest.fn(async () => [{ categoryId: 'c1', _sum: { amount: D(3000) } }]), // live actual
      aggregate: jest.fn(async () => ({ _sum: { amount: D(5000) } })), // pending
    },
    expenseCategory: { findMany: jest.fn(async () => [{ id: 'c1', name: 'RENT' }]) },
  };
}

describe('FinancialReportsService.profitLoss (hybrid reconciliation, spec §8/§20)', () => {
  it('merges pre-aggregated + live totals and reconciles exactly against the manual sum', async () => {
    const prisma = makePrisma();
    const svc = new FinancialReportsService(prisma as never);
    const pnl = await svc.profitLoss(user, range, 'br-1');

    // Manual reconciliation of both portions:
    const grossRevenue = 50000 + 20000; // 70000
    const returns = 2000 + 1000; // 3000
    const cogs = 30000 + 12000; // 42000
    const expenses = 10000 + 3000; // 13000 (RENT across both portions)
    expect(pnl.grossRevenue).toBe(grossRevenue);
    expect(pnl.returnsAmount).toBe(returns);
    expect(pnl.netRevenue).toBe(grossRevenue - returns); // 67000
    expect(pnl.costOfGoodsSold).toBe(cogs);
    expect(pnl.grossProfit).toBe(grossRevenue - returns - cogs); // 25000
    expect(pnl.totalOperatingExpenses).toBe(expenses);
    expect(pnl.netProfit).toBe(grossRevenue - returns - cogs - expenses); // 12000
    expect(pnl.taxCollected).toBe(4000 + 1600); // 5600
  });

  it('reports pending expenses separately without deducting them from net profit (§21)', async () => {
    const svc = new FinancialReportsService(makePrisma() as never);
    const pnl = await svc.profitLoss(user, range, 'br-1');
    expect(pnl.pendingExpensesAmount).toBe(5000);
    expect(pnl.netProfit).toBe(12000); // unchanged by pending
    expect(pnl.netProfitIfPendingApproved).toBe(7000);
  });

  it('returns an all-zero statement for a branch the user cannot access', async () => {
    const svc = new FinancialReportsService(makePrisma() as never);
    const pnl = await svc.profitLoss(user, range, 'br-OTHER');
    expect(pnl.netProfit).toBe(0);
    expect(pnl.grossRevenue).toBe(0);
  });
});
