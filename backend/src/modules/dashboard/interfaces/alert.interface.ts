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

export interface PurchaseSnapshot {
  pendingOrders: Array<{
    id: string;
    poNumber: string;
    supplierId: string;
    supplierName: string | null;
    status: string;
    totalAmount: number;
    createdAt: string;
  }>;
  pendingOrdersCount: number;
}

export interface CashSummary {
  totalsByMethod: Record<string, number>;
  total: number;
  scope: 'own' | 'all';
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
