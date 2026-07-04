import { apiClient } from '../../../shared/api/client';
import {
  ActivityFeedItem,
  CashSummary,
  DashboardAlert,
  DashboardSummary,
  PurchaseSnapshot,
  SalesTrendPoint,
  TopSellingItem,
  WidgetPreference,
} from '../types/dashboard.types';

export interface DateRangeParams {
  branchId?: string | null;
  from?: string | null;
  to?: string | null;
}

function qs(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

export const dashboardApi = {
  getSummary: (params: DateRangeParams) =>
    apiClient.get<DashboardSummary>(`/dashboard/summary${qs(params)}`),

  getSalesTrend: (params: DateRangeParams & { granularity?: string }) =>
    apiClient.get<SalesTrendPoint[]>(`/dashboard/sales-trend${qs(params)}`),

  getTopSelling: (params: DateRangeParams & { metric?: 'qty' | 'revenue'; limit?: number }) =>
    apiClient.get<TopSellingItem[]>(`/dashboard/top-selling${qs(params)}`),

  getAlerts: (params: { branchId?: string | null; type?: string }) =>
    apiClient.get<DashboardAlert[]>(`/dashboard/alerts${qs(params)}`),

  acknowledgeAlert: (id: string, body: { branchId: string; alertType: string; note?: string }) =>
    apiClient.post<null>(`/dashboard/alerts/${id}/acknowledge`, body),

  getActivityFeed: (params: { branchId?: string | null; limit?: number; cursor?: string }) =>
    apiClient.get<ActivityFeedItem[]>(`/dashboard/activity-feed${qs(params)}`),

  getPurchaseSnapshot: (params: { branchId?: string | null }) =>
    apiClient.get<PurchaseSnapshot>(`/dashboard/purchase-snapshot${qs(params)}`),

  getCashSummary: (params: DateRangeParams & { cashierId?: string }) =>
    apiClient.get<CashSummary>(`/dashboard/cash-summary${qs(params)}`),

  getPreferences: (branchId?: string | null) =>
    apiClient.get<WidgetPreference[]>(`/dashboard/preferences${qs({ branchId })}`),

  savePreferences: (widgets: WidgetPreference[], branchId?: string | null) =>
    apiClient.put<null>('/dashboard/preferences', { branchId, widgets }),
};
