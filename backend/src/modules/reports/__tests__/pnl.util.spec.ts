import { assembleProfitLoss } from '../pnl.util';

describe('assembleProfitLoss (P&L reconciliation)', () => {
  it('combines revenue, returns, COGS and expenses into an accurate net profit', () => {
    const pnl = assembleProfitLoss({
      grossRevenue: 100000,
      returnsAmount: 5000,
      costOfGoodsSold: 60000,
      taxCollected: 8000,
      expensesByCategory: [
        { categoryId: 'c1', categoryName: 'RENT', amount: 20000 },
        { categoryId: 'c2', categoryName: 'UTILITIES', amount: 5000 },
      ],
    });
    // netRevenue = 100000 - 5000 = 95000
    expect(pnl.netRevenue).toBe(95000);
    // grossProfit = 95000 - 60000 = 35000
    expect(pnl.grossProfit).toBe(35000);
    // opex = 25000 → netProfit = 35000 - 25000 = 10000
    expect(pnl.totalOperatingExpenses).toBe(25000);
    expect(pnl.netProfit).toBe(10000);
    // margins off net revenue
    expect(pnl.grossMarginPercent).toBeCloseTo(36.84, 1);
    expect(pnl.netMarginPercent).toBeCloseTo(10.53, 1);
  });

  it('reconciles: netProfit === netRevenue − COGS − Σexpenses (independent recompute)', () => {
    const grossRevenue = 73412.55, returnsAmount = 1234.5, costOfGoodsSold = 40987.1;
    const expensesByCategory = [
      { categoryId: 'a', categoryName: 'A', amount: 1111.11 },
      { categoryId: 'b', categoryName: 'B', amount: 2222.22 },
      { categoryId: 'c', categoryName: 'C', amount: 333.33 },
    ];
    const pnl = assembleProfitLoss({ grossRevenue, returnsAmount, costOfGoodsSold, taxCollected: 0, expensesByCategory });
    const expectedNet = Math.round((grossRevenue - returnsAmount - costOfGoodsSold - (1111.11 + 2222.22 + 333.33)) * 100) / 100;
    expect(pnl.netProfit).toBe(expectedNet);
  });

  it('excludes pending expenses from net profit but surfaces them separately (§21)', () => {
    const pnl = assembleProfitLoss({
      grossRevenue: 50000, returnsAmount: 0, costOfGoodsSold: 30000, taxCollected: 0,
      expensesByCategory: [{ categoryId: 'c1', categoryName: 'RENT', amount: 10000 }],
      pendingExpensesAmount: 4000,
    });
    expect(pnl.netProfit).toBe(10000); // 20000 gross − 10000 approved opex; pending NOT deducted
    expect(pnl.pendingExpensesAmount).toBe(4000);
    expect(pnl.netProfitIfPendingApproved).toBe(6000);
  });

  it('handles a genuinely empty period without dividing by zero', () => {
    const pnl = assembleProfitLoss({ grossRevenue: 0, returnsAmount: 0, costOfGoodsSold: 0, taxCollected: 0, expensesByCategory: [] });
    expect(pnl.netProfit).toBe(0);
    expect(pnl.grossMarginPercent).toBe(0);
    expect(pnl.netMarginPercent).toBe(0);
  });
});
