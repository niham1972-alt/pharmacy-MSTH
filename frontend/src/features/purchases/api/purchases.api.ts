import { apiClient } from '../../../shared/api/client';
import { GrnInvoiceAdjustments, GrnLineInput, PODetail, POLineInput, POListItem, PendingApproval, PurchaseSummary, Supplier } from '../types/purchase.types';

function qs(params: object): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
}

export interface POListParams {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
  status?: string;
  paymentStatus?: string;
  branchId?: string | null;
}

export const purchasesApi = {
  suppliers: () => apiClient.get<Supplier[]>('/purchases/suppliers'),
  createSupplier: (body: { name: string; contactPerson?: string; phone?: string; paymentTermsDays?: number }) => apiClient.post<Supplier>('/purchases/suppliers', body),

  summary: (branchId?: string | null) => apiClient.get<PurchaseSummary>(`/purchases/summary${qs({ branchId })}`),
  pendingApprovals: (branchId?: string | null) => apiClient.get<PendingApproval[]>(`/purchases/pending-approvals${qs({ branchId })}`),

  listOrders: (params: POListParams) => apiClient.get<POListItem[]>(`/purchases/orders${qs(params)}`),
  getOrder: (id: string) => apiClient.get<PODetail>(`/purchases/orders/${id}`),
  createOrder: (body: { supplierId: string; expectedDeliveryDate?: string; notes?: string; items: POLineInput[] }) => apiClient.post<PODetail>('/purchases/orders', body),
  updateOrder: (id: string, body: { supplierId?: string; notes?: string; items?: POLineInput[] }) => apiClient.put<PODetail>(`/purchases/orders/${id}`, body),
  submit: (id: string) => apiClient.post<{ status: string; autoApproved: boolean }>(`/purchases/orders/${id}/submit`),
  approve: (id: string) => apiClient.post(`/purchases/orders/${id}/approve`),
  reject: (id: string, reason: string) => apiClient.post(`/purchases/orders/${id}/reject`, { reason }),
  cancel: (id: string, reason?: string) => apiClient.post(`/purchases/orders/${id}/cancel`, { reason }),

  createGrn: (body: { purchaseOrderId?: string; supplierId?: string; notes?: string; items: GrnLineInput[]; varianceAcknowledged?: boolean; varianceNote?: string } & GrnInvoiceAdjustments) =>
    apiClient.post(`/purchases/grn`, body),
  getGrn: (id: string) => apiClient.get(`/purchases/grn/${id}`),

  recordPayment: (id: string, body: { amount: number; method: string; referenceNumber?: string; notes?: string }) => apiClient.post(`/purchases/orders/${id}/payments`, body),
  listPayments: (id: string) => apiClient.get(`/purchases/orders/${id}/payments`),
};
