import { apiClient } from '../../../shared/api/client';
import {
  ExportFormat, ExportJob, PnlStatement, ReportFilters, ReportType, SavedReportConfiguration, TabularReport,
} from '../types/reports.types';

const ENDPOINT: Record<ReportType, string> = {
  PROFIT_LOSS: 'profit-loss', SALES_REGISTER: 'sales-register', PURCHASE_SUMMARY: 'purchase-summary',
  ACCOUNTS_PAYABLE: 'accounts-payable', TAX_SUMMARY: 'tax-summary', STOCK_VALUATION: 'stock-valuation',
  STOCK_MOVEMENT: 'stock-movement', EXPIRING_STOCK: 'expiring-stock', BATCH_TRACEABILITY: 'batch-traceability',
  TOP_SELLING: 'top-selling', SALES_RETURNS: 'sales-returns', CUSTOMER_HISTORY: 'customer-history',
  CONTROLLED_SUBSTANCE_LOG: 'controlled-substance-log', SUPPLIER_PERFORMANCE: 'supplier-performance',
  PURCHASE_RETURNS: 'purchase-returns', SHRINKAGE: 'shrinkage', AUDIT_SUMMARY: 'audit-summary',
};

function qs(f: ReportFilters): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
}

export const reportsApi = {
  /** Path-param reports (batch traceability / customer history) go on the URL. */
  run: <T = TabularReport>(type: ReportType, filters: ReportFilters) => {
    let path = ENDPOINT[type];
    const f = { ...filters };
    if (type === 'BATCH_TRACEABILITY' && f.batchId) { path += `/${encodeURIComponent(f.batchId)}`; delete f.batchId; }
    if (type === 'CUSTOMER_HISTORY' && f.customerId) { path += `/${encodeURIComponent(f.customerId)}`; delete f.customerId; }
    return apiClient.get<T>(`/reports/${path}${qs(f)}`);
  },
  profitLoss: (filters: ReportFilters) => apiClient.get<PnlStatement>(`/reports/profit-loss${qs(filters)}`),

  requestExport: (reportType: ReportType, format: ExportFormat, filters: ReportFilters) =>
    apiClient.post<{ jobId: string; status: string }>('/reports/export', { reportType, format, filters }),
  exportStatus: (jobId: string) => apiClient.get<ExportJob>(`/reports/export/${jobId}`),

  savedList: () => apiClient.get<SavedReportConfiguration[]>('/reports/saved-configurations'),
  savedCreate: (body: { reportType: ReportType; name: string; filters: ReportFilters }) => apiClient.post<SavedReportConfiguration>('/reports/saved-configurations', body),
  savedDelete: (id: string) => apiClient.delete<{ deleted: boolean }>(`/reports/saved-configurations/${id}`),
};
