import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../api/reports.api';
import { PnlStatement, ReportFilters, ReportType, TabularReport } from '../types/reports.types';

/** Generic tabular report fetch (spec §9 — one hook pattern reused per report). */
export function useTabularReport(type: ReportType, filters: ReportFilters, enabled = true) {
  return useQuery({
    queryKey: ['report', type, filters],
    queryFn: async () => (await reportsApi.run<TabularReport>(type, filters)).data,
    enabled,
  });
}

export function useProfitLossReport(filters: ReportFilters, enabled = true) {
  return useQuery({
    queryKey: ['report', 'PROFIT_LOSS', filters],
    queryFn: async () => (await reportsApi.profitLoss(filters)).data as PnlStatement,
    enabled,
  });
}
