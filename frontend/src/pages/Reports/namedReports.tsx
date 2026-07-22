import { ReportView } from '../../features/reports/components/ReportView';
import { REPORT_CATALOG, ReportType } from '../../features/reports/types/reports.types';

/** Thin named-page wrappers (spec §9). Each binds ReportView to one catalog entry;
 *  the dynamic GenericReportPage covers the remaining report types. */
function pageFor(type: ReportType) {
  const entry = REPORT_CATALOG.find((r) => r.type === type)!;
  return function ReportPage() { return <ReportView entry={entry} />; };
}

export const ProfitLossReportPage = pageFor('PROFIT_LOSS');
export const SalesRegisterPage = pageFor('SALES_REGISTER');
export const StockValuationReportPage = pageFor('STOCK_VALUATION');
export const ExpiringStockReportPage = pageFor('EXPIRING_STOCK');
export const TopSellingReportPage = pageFor('TOP_SELLING');
export const SupplierPerformanceReportPage = pageFor('SUPPLIER_PERFORMANCE');
