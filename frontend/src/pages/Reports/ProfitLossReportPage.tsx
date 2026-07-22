import { ReportView } from '../../features/reports/components/ReportView';
import { REPORT_CATALOG } from '../../features/reports/types/reports.types';

export function ProfitLossReportPage() {
  const entry = REPORT_CATALOG.find((r) => r.type === 'PROFIT_LOSS');
  return entry ? <ReportView entry={entry} /> : null;
}
