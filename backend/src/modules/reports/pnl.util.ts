/**
 * Pure Profit & Loss assembly (spec §2.1 / §21). Kept free of Prisma/IO so the
 * financial math — the module's single most important correctness property — is
 * unit-tested exhaustively and reconciles exactly against source figures.
 *
 * Policy (spec §21): only APPROVED / not-required expenses count toward the
 * "actual" net profit; PENDING_APPROVAL expenses are reported separately as a
 * supplementary figure, never silently folded into the bottom line.
 */
export interface PnlInput {
  grossRevenue: number; // Module 4 sales grandTotal (COMPLETED)
  returnsAmount: number; // Module 10 refunds in period
  costOfGoodsSold: number; // Σ SaleItem.unitCost × qty (COMPLETED)
  taxCollected: number; // Module 4 sales tax
  expensesByCategory: Array<{ categoryId: string; categoryName: string; amount: number }>; // approved/actual
  pendingExpensesAmount?: number; // informational only
}

export interface PnlStatement {
  grossRevenue: number;
  returnsAmount: number;
  netRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMarginPercent: number;
  expensesByCategory: Array<{ categoryId: string; categoryName: string; amount: number }>;
  totalOperatingExpenses: number;
  netProfit: number;
  netMarginPercent: number;
  taxCollected: number;
  /** Not deducted from netProfit — a "what if these get approved" hint. */
  pendingExpensesAmount: number;
  netProfitIfPendingApproved: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const pct = (part: number, whole: number) => (whole === 0 ? 0 : round2((part / whole) * 100));

export function assembleProfitLoss(input: PnlInput): PnlStatement {
  const grossRevenue = round2(input.grossRevenue);
  const returnsAmount = round2(input.returnsAmount);
  const netRevenue = round2(grossRevenue - returnsAmount);
  const costOfGoodsSold = round2(input.costOfGoodsSold);
  const grossProfit = round2(netRevenue - costOfGoodsSold);

  const expensesByCategory = input.expensesByCategory
    .map((c) => ({ ...c, amount: round2(c.amount) }))
    .sort((a, b) => b.amount - a.amount);
  const totalOperatingExpenses = round2(expensesByCategory.reduce((s, c) => s + c.amount, 0));
  const netProfit = round2(grossProfit - totalOperatingExpenses);
  const pendingExpensesAmount = round2(input.pendingExpensesAmount ?? 0);

  return {
    grossRevenue,
    returnsAmount,
    netRevenue,
    costOfGoodsSold,
    grossProfit,
    grossMarginPercent: pct(grossProfit, netRevenue),
    expensesByCategory,
    totalOperatingExpenses,
    netProfit,
    netMarginPercent: pct(netProfit, netRevenue),
    taxCollected: round2(input.taxCollected),
    pendingExpensesAmount,
    netProfitIfPendingApproved: round2(netProfit - pendingExpensesAmount),
  };
}
