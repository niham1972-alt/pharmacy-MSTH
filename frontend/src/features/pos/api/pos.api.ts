import { apiClient } from '../../../shared/api/client';

export interface SessionData {
  id: string;
  cashierId: string;
  status: string;
  openingFloat: number;
  expectedCash: number | null;
  actualCash: number | null;
  variance: number | null;
  openedAt: string;
  closedAt: string | null;
  salesCount: number;
  salesTotal: number;
  cashCollected: number;
  byMethod: Array<{ method: string; amount: number }>;
  flaggedForReview?: boolean;
}

export interface FinalizePayload {
  idempotencyKey?: string;
  customerId?: string;
  notes?: string;
  discountApprovedBy?: string;
  items: Array<{ medicineId: string; quantity: number; discountAmount?: number; prescriptionVerifiedBy?: string; prescriptionReference?: string }>;
  payments: Array<{ method: string; amount: number; tenderedAmount?: number; referenceNumber?: string }>;
  compliance?: Array<{ medicineId: string; type: string; prescribingDoctor?: string; patientName?: string; quantityDispensed: number }>;
}

export interface PriceCheckLine {
  medicineId: string;
  name: string;
  unitPrice: number;
  currentStock: number;
  stockOk: boolean;
  prescriptionRequired: boolean;
  controlled: boolean;
  discontinued: boolean;
  fefoBatch: { batchNumber: string; expiryDate: string } | null;
}

export const posApi = {
  currentSession: () => apiClient.get<SessionData | null>('/sales/sessions/current'),
  openSession: (openingFloat: number) => apiClient.post<SessionData>('/sales/sessions', { openingFloat }),
  closeSession: (id: string, actualCash: number) => apiClient.post<SessionData>(`/sales/sessions/${id}/close`, { actualCash }),
  finalize: (payload: FinalizePayload) => apiClient.post<{ id: string; saleNumber: string }>('/sales', payload),
  discountApproval: (approverEmail: string, approverPassword: string) => apiClient.post<{ approverId: string; role: string }>('/sales/discount-approval', { approverEmail, approverPassword }),
  priceCheck: (items: Array<{ medicineId: string; quantity: number }>) => apiClient.post<{ lines: PriceCheckLine[]; totals: { grandTotal: number } }>('/sales/cart/price-check', { items }),
  park: (label: string | undefined, cartSnapshot: unknown) => apiClient.post<{ id: string }>('/sales/parked', { label, cartSnapshot }),
  listParked: () => apiClient.get<Array<{ id: string; label: string | null; cartSnapshot: unknown; createdAt: string }>>('/sales/parked'),
  discardParked: (id: string) => apiClient.delete(`/sales/parked/${id}`),
};

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  hasPrescriptionOnFile?: boolean;
}

// Module 8 owns customers. POS uses the narrow typeahead (no health/financial
// data) + the fast quick-add (name + phone, required).
export const customersApi = {
  search: (term: string) => apiClient.get<Customer[]>(`/customers/search${term ? `?q=${encodeURIComponent(term)}` : ''}`),
  create: (name: string, phone: string) => apiClient.post<Customer>('/customers/quick-add', { name, phone }),
};

export const salesApi = {
  list: (params: Record<string, string | number | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') s.set(k, String(v));
    return apiClient.get<Array<{ id: string; saleNumber: string; saleDate: string; status: string; cashierId: string; itemCount: number; grandTotal: number; methods: string[] }>>(`/sales${s.toString() ? `?${s}` : ''}`);
  },
  detail: (id: string) => apiClient.get<SaleDetail>(`/sales/${id}`),
  void: (id: string, reason: string) => apiClient.post(`/sales/${id}/void`, { reason }),
};

export interface SaleDetail {
  id: string;
  saleNumber: string;
  saleDate: string;
  status: string;
  cashierId: string;
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  totalCost: number;
  voidReason: string | null;
  items: Array<{ id: string; name: string; sku: string | null; quantity: number; unitPrice: number; discountAmount: number; lineTotal: number; batchId: string | null }>;
  payments: Array<{ method: string; amount: number; tenderedAmount: number | null; changeDue: number | null }>;
  complianceRecords: Array<{ id: string; type: string; patientName: string | null; isVoided: boolean }>;
}
