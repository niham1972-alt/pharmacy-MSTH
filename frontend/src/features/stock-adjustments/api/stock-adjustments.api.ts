import { apiClient } from '../../../shared/api/client';
import {
  Adjustment, AdjustmentDetail, BulkResult, CreateAdjustmentInput, ShrinkageReport,
} from '../types/stock-adjustment.types';

function qs(p: Record<string, string | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : '';
}

export const stockAdjustmentsApi = {
  create: (body: CreateAdjustmentInput) => apiClient.post<Adjustment>('/stock-adjustments', body),
  bulk: (items: CreateAdjustmentInput[]) => apiClient.post<BulkResult>('/stock-adjustments/bulk', { items }),
  list: (params: Record<string, string | undefined>) => apiClient.get<Adjustment[]>(`/stock-adjustments${qs(params)}`),
  detail: (id: string) => apiClient.get<AdjustmentDetail>(`/stock-adjustments/${id}`),
  pending: () => apiClient.get<Adjustment[]>('/stock-adjustments/pending'),
  approve: (id: string) => apiClient.post<Adjustment>(`/stock-adjustments/${id}/approve`),
  reject: (id: string, rejectedReason: string) => apiClient.post<Adjustment>(`/stock-adjustments/${id}/reject`, { rejectedReason }),
  shrinkage: (params: Record<string, string | undefined>) => apiClient.get<ShrinkageReport>(`/stock-adjustments/reports/shrinkage${qs(params)}`),
};
