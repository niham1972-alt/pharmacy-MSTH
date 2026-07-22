export type ReportType =
  | 'PROFIT_LOSS' | 'SALES_REGISTER' | 'PURCHASE_SUMMARY' | 'ACCOUNTS_PAYABLE' | 'TAX_SUMMARY'
  | 'STOCK_VALUATION' | 'STOCK_MOVEMENT' | 'EXPIRING_STOCK' | 'BATCH_TRACEABILITY' | 'TOP_SELLING'
  | 'SALES_RETURNS' | 'CUSTOMER_HISTORY' | 'CONTROLLED_SUBSTANCE_LOG' | 'SUPPLIER_PERFORMANCE'
  | 'PURCHASE_RETURNS' | 'SHRINKAGE' | 'AUDIT_SUMMARY';

export type ExportFormat = 'CSV' | 'PDF';
export type ReportCategory = 'Financial' | 'Inventory & Operational' | 'Sales & Customer' | 'Supplier & Compliance';

export interface TabularColumn { key: string; label: string; numeric?: boolean }
export interface TabularReport {
  columns: TabularColumn[];
  rows: Array<Record<string, string | number | null>>;
  summary?: Record<string, string | number>;
  meta?: Record<string, unknown>;
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
  pendingExpensesAmount: number;
  netProfitIfPendingApproved: number;
  dateFrom: string;
  dateTo: string;
}

export type DateRangeType = 'custom' | 'rolling_last_7_days' | 'rolling_last_month' | 'rolling_this_month' | 'rolling_this_year';

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  dateRangeType?: DateRangeType;
  metric?: string;
  customerId?: string;
  batchId?: string;
  medicineId?: string;
  cashierId?: string;
  paymentMethod?: string;
  limit?: string;
}

export interface SavedReportConfiguration {
  id: string;
  reportType: ReportType;
  name: string;
  filters: ReportFilters;
  createdAt: string;
}

export type ExportJobStatus = 'GENERATING' | 'READY' | 'FAILED';
export interface ExportJob {
  id: string;
  reportType: ReportType;
  format: ExportFormat;
  status: ExportJobStatus;
  fileUrl: string | null;
  fileName: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** Which extra filters a report needs (drives the shared filter bar). */
export interface ReportCatalogEntry {
  type: ReportType;
  title: string;
  category: ReportCategory;
  description: string;
  roles: string[];
  needsRange: boolean;
  needsBranch: boolean;
  needsIdParam?: 'customerId' | 'batchId';
  metricToggle?: boolean;
  isStatement?: boolean; // P&L → formal statement view
}

export const REPORT_CATALOG: ReportCatalogEntry[] = [
  { type: 'PROFIT_LOSS', title: 'Profit & Loss Statement', category: 'Financial', description: 'Revenue net of returns, less cost-of-goods and operating expenses (Modules 4/10/13).', roles: ['admin', 'accountant'], needsRange: true, needsBranch: true, isStatement: true },
  { type: 'SALES_REGISTER', title: 'Sales Register', category: 'Financial', description: 'Itemized list of completed sales for the period (Module 4).', roles: ['admin', 'pharmacist', 'accountant', 'auditor'], needsRange: true, needsBranch: true },
  { type: 'PURCHASE_SUMMARY', title: 'Purchase Summary', category: 'Financial', description: 'Total spend by supplier for the period (Module 3).', roles: ['admin', 'inventory_manager', 'accountant', 'auditor'], needsRange: true, needsBranch: true },
  { type: 'ACCOUNTS_PAYABLE', title: 'Accounts Payable Summary', category: 'Financial', description: 'Formal point-in-time payables across expenses and purchase orders (Module 13/3).', roles: ['admin', 'accountant', 'auditor'], needsRange: false, needsBranch: true },
  { type: 'TAX_SUMMARY', title: 'Tax / VAT Summary', category: 'Financial', description: 'Output tax collected vs input tax paid, for the period.', roles: ['admin', 'accountant'], needsRange: true, needsBranch: true },
  { type: 'STOCK_VALUATION', title: 'Stock Valuation', category: 'Inventory & Operational', description: 'Current inventory value by category, at cost (Module 5/6).', roles: ['admin', 'inventory_manager', 'accountant', 'auditor'], needsRange: false, needsBranch: true },
  { type: 'STOCK_MOVEMENT', title: 'Stock Movement', category: 'Inventory & Operational', description: 'Full stock ledger export for the period (Module 5).', roles: ['admin', 'inventory_manager', 'accountant', 'auditor'], needsRange: true, needsBranch: true },
  { type: 'EXPIRING_STOCK', title: 'Expiring Stock', category: 'Inventory & Operational', description: 'Tiered near-expiry batches with value at risk (Module 6).', roles: ['admin', 'pharmacist', 'inventory_manager', 'auditor'], needsRange: false, needsBranch: true },
  { type: 'BATCH_TRACEABILITY', title: 'Batch Traceability', category: 'Inventory & Operational', description: 'Full lifecycle of a batch: received → sold/returned → written off (Module 6).', roles: ['admin', 'pharmacist', 'inventory_manager', 'auditor'], needsRange: false, needsBranch: false, needsIdParam: 'batchId' },
  { type: 'TOP_SELLING', title: 'Top-Selling Medicines', category: 'Sales & Customer', description: 'Best sellers by quantity or revenue (Module 4).', roles: ['admin', 'pharmacist', 'inventory_manager', 'auditor'], needsRange: true, needsBranch: true, metricToggle: true },
  { type: 'SALES_RETURNS', title: 'Sales Returns', category: 'Sales & Customer', description: 'Return rate by medicine and reason (Module 10).', roles: ['admin', 'pharmacist', 'auditor'], needsRange: true, needsBranch: true },
  { type: 'CUSTOMER_HISTORY', title: 'Customer Purchase History', category: 'Sales & Customer', description: 'Purchase history for a specific customer (Module 8).', roles: ['admin', 'pharmacist'], needsRange: true, needsBranch: false, needsIdParam: 'customerId' },
  { type: 'CONTROLLED_SUBSTANCE_LOG', title: 'Controlled Substance Log', category: 'Supplier & Compliance', description: 'Regulatory dispensing log built on Module 15 audit data.', roles: ['admin', 'pharmacist', 'auditor'], needsRange: true, needsBranch: false },
  { type: 'SUPPLIER_PERFORMANCE', title: 'Supplier Performance', category: 'Supplier & Compliance', description: 'On-time delivery, variance frequency and spend (Module 7/3).', roles: ['admin', 'inventory_manager', 'accountant', 'auditor'], needsRange: true, needsBranch: true },
  { type: 'PURCHASE_RETURNS', title: 'Purchase Returns', category: 'Supplier & Compliance', description: 'Returns to supplier by settlement status (Module 9).', roles: ['admin', 'inventory_manager', 'accountant', 'auditor'], needsRange: true, needsBranch: true },
  { type: 'SHRINKAGE', title: 'Shrinkage / Loss', category: 'Supplier & Compliance', description: 'Loss by reason from stock adjustments (Module 11).', roles: ['admin', 'inventory_manager', 'auditor'], needsRange: true, needsBranch: true },
  { type: 'AUDIT_SUMMARY', title: 'Audit Summary', category: 'Supplier & Compliance', description: 'Sensitive/critical events grouped by type for the period (Module 15).', roles: ['admin', 'auditor'], needsRange: true, needsBranch: false },
];

export const REPORT_ROUTE: Record<ReportType, string> = REPORT_CATALOG.reduce((acc, r) => {
  acc[r.type] = `/reports/${r.type.toLowerCase().replace(/_/g, '-')}`;
  return acc;
}, {} as Record<ReportType, string>);
