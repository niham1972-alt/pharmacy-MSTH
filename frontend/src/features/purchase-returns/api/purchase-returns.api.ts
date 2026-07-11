import { apiClient } from '../../../shared/api/client';
import type { CreateReturnPayload, PurchaseReturnDetail, PurchaseReturnListRow, ReturnableResult, SettlementStatus } from '../types/purchase-return.types';

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
function qs(params: Record<string, string | number | undefined>): string {
  const s = Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  return s ? `?${s}` : '';
}

export const purchaseReturnsApi = {
  returnableItems: (grnId: string) => apiClient.get<ReturnableResult>(`/purchase-returns/returnable-items/${grnId}`),
  create: (payload: CreateReturnPayload) => apiClient.post<PurchaseReturnDetail>('/purchase-returns', payload),
  list: (params: Record<string, string | number | undefined>) => apiClient.get<PurchaseReturnListRow[]>(`/purchase-returns${qs(params)}`) as Promise<{ data: PurchaseReturnListRow[]; meta: Paginated<PurchaseReturnListRow>['meta'] }>,
  pending: (params: Record<string, string | number | undefined>) => apiClient.get<PurchaseReturnListRow[]>(`/purchase-returns/pending${qs(params)}`) as Promise<{ data: PurchaseReturnListRow[]; meta: Paginated<PurchaseReturnListRow>['meta'] }>,
  detail: (id: string) => apiClient.get<PurchaseReturnDetail>(`/purchase-returns/${id}`),
  updateSettlement: (id: string, body: { settlementStatus: SettlementStatus; actualCreditedAmount?: number; supplierCreditNoteRef?: string; notes?: string }) => apiClient.put<PurchaseReturnDetail>(`/purchase-returns/${id}/settlement`, body),
  // Module 3's GRN list (no server search param) — filtered client-side by number.
  listGrns: () => apiClient.get<Array<{ id: string; grnNumber: string; supplierName?: string | null; receivedDate?: string }>>(`/purchases/grn?limit=100`) as Promise<{ data: Array<{ id: string; grnNumber: string; supplierName?: string | null; receivedDate?: string }>; meta: unknown }>,
};
