export interface MoneyChangeMetric {
  amount: number;
  changePct: number | 'new';
}

export interface DashboardSummary {
  todaySales?: { amount: number; count: number; changePct: number | 'new' };
  todayProfit?: MoneyChangeMetric;
  monthPurchases?: { amount: number };
  monthExpenses?: { amount: number };
  lowStockCount?: number;
  expiringSoonCount?: number;
  outOfStockCount?: number;
  pendingPurchaseOrders?: number;
}

export interface SalesTrendPoint {
  date: string;
  revenue: number;
  profit?: number;
}

export interface TopSellingItem {
  medicineId: string;
  name: string;
  quantitySold: number;
  revenue: number;
}

export type AlertSeverity = 'red' | 'orange' | 'yellow';

export interface DashboardAlert {
  id: string;
  type: 'LOW_STOCK' | 'EXPIRY' | 'OUT_OF_STOCK';
  severity: AlertSeverity;
  referenceId: string;
  title: string;
  detail: string;
  acknowledged: boolean;
}

export interface ActivityFeedItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface PurchaseSnapshot {
  pendingOrders: Array<{ id: string; supplierId: string; status: string; totalAmount: number; createdAt: string }>;
  pendingOrdersCount: number;
}

export interface CashSummary {
  totalsByMethod: Record<string, number>;
  total: number;
  scope: 'own' | 'all';
}

export interface WidgetPreference {
  widgetKey: string;
  isVisible: boolean;
  position: number;
  config?: Record<string, unknown>;
}
