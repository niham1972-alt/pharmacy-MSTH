import { apiClient } from '../../../shared/api/client';
import type { CreateReturnPayload, EligibilityResult, ReturnRateByMedicine, ReturnRateByReason, SalesReturnDetail, SalesReturnListRow, StoreCredit } from '../types/sales-return.types';

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

function qs(params: Record<string, string | number | undefined>): string {
  const s = Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  return s ? `?${s}` : '';
}

export const salesReturnsApi = {
  eligibility: (saleId: string) => apiClient.get<EligibilityResult>(`/sales-returns/eligibility/${saleId}`),
  create: (payload: CreateReturnPayload) => apiClient.post<SalesReturnDetail>('/sales-returns', payload),
  list: (params: Record<string, string | number | undefined>) => apiClient.get<SalesReturnListRow[]>(`/sales-returns${qs(params)}`) as Promise<{ data: SalesReturnListRow[]; meta: Paginated<SalesReturnListRow>['meta'] }>,
  detail: (id: string) => apiClient.get<SalesReturnDetail>(`/sales-returns/${id}`),
  byMedicine: (params: Record<string, string | undefined>) => apiClient.get<ReturnRateByMedicine[]>(`/sales-returns/reports/by-medicine${qs(params)}`),
  byReason: (params: Record<string, string | undefined>) => apiClient.get<ReturnRateByReason[]>(`/sales-returns/reports/by-reason${qs(params)}`),
  storeCredit: (customerId: string) => apiClient.get<StoreCredit>(`/customers/${customerId}/store-credit`),
  // Look up a sale by its number to find the sale id for a return (uses Module 4's list search).
  findSaleByNumber: (saleNumber: string) => apiClient.get<Array<{ id: string; saleNumber: string }>>(`/sales?search=${encodeURIComponent(saleNumber)}&limit=5`) as Promise<{ data: Array<{ id: string; saleNumber: string; status: string }>; meta: unknown }>,
};
