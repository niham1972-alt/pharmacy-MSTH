/** Canonical report identifiers (used for RBAC mirroring, exports, saved configs). */
export type ReportType =
  | 'PROFIT_LOSS'
  | 'SALES_REGISTER'
  | 'PURCHASE_SUMMARY'
  | 'ACCOUNTS_PAYABLE'
  | 'TAX_SUMMARY'
  | 'STOCK_VALUATION'
  | 'STOCK_MOVEMENT'
  | 'EXPIRING_STOCK'
  | 'BATCH_TRACEABILITY'
  | 'TOP_SELLING'
  | 'SALES_RETURNS'
  | 'CUSTOMER_HISTORY'
  | 'CONTROLLED_SUBSTANCE_LOG'
  | 'SUPPLIER_PERFORMANCE'
  | 'PURCHASE_RETURNS'
  | 'SHRINKAGE'
  | 'AUDIT_SUMMARY';

export type ExportFormat = 'CSV' | 'PDF';

/** Common filters shared by most reports; report-specific extras arrive as extra props. */
export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  categoryId?: string;
  supplierId?: string;
  customerId?: string;
  medicineId?: string;
  cashierId?: string;
  paymentMethod?: string;
  reasonCode?: string;
  batchId?: string;
  metric?: string;
  limit?: string;
  /** Saved-config rolling window: recompute the actual range on each run. */
  dateRangeType?: 'custom' | 'rolling_last_month' | 'rolling_last_7_days' | 'rolling_this_month' | 'rolling_this_year';
}

/** A tabular report result — a header row + rows, plus an optional summary block. */
export interface TabularReport {
  columns: Array<{ key: string; label: string; numeric?: boolean }>;
  rows: Array<Record<string, string | number | null>>;
  summary?: Record<string, string | number>;
  meta?: Record<string, unknown>;
}
