export interface MoneyChangeMetric {
  amount: number;
  changePct: number | 'new';
}

export interface CountMetric {
  count: number;
  changePct?: number | 'new';
}

/**
 * `todayProfit` is entirely absent (not just zero) for the `cashier` role —
 * enforced by DashboardService, never left to the frontend to hide.
 */
export interface DashboardSummary {
  todaySales: { amount: number; count: number; changePct: number | 'new' };
  todayProfit?: MoneyChangeMetric;
  monthPurchases: { amount: number };
  monthExpenses: { amount: number };
  lowStockCount: number;
  expiringSoonCount: number;
  outOfStockCount: number;
  pendingPurchaseOrders: number;
}
