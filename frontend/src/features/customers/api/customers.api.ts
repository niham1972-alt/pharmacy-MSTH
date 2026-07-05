import { apiClient } from '../../../shared/api/client';

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  registeredAt: string;
  isActive: boolean;
  tags: Array<{ id: string; name: string; color: string | null }>;
  prescriptionCount: number;
  lastPurchaseAt: string | null;
  lifetimeSpend?: number;
}

export interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  nationalIdOrPatientId: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  consentHealthDataStorage: boolean;
  consentMarketingContact: boolean;
  isActive: boolean;
  isMergedInto: string | null;
  registeredAt: string;
  prescriptionCount: number;
  tags: Array<{ id: string; name: string; color: string | null }>;
  notes: Array<{ id: string; note: string; createdBy: string; createdAt: string }>;
  lifetimeSpend?: number;
  hasHealthProfile: boolean;
}

export interface HealthProfile {
  customerId: string;
  allergiesFreeText: string | null;
  allergyTags: string[];
  chronicConditionsFreeText: string | null;
  chronicConditionTags: string[];
  updatedBy?: string;
  updatedAt?: string;
  exists: boolean;
}

export interface PrescriptionRow {
  id: string;
  fileUrl: string | null;
  referenceNumber: string | null;
  prescribingDoctor: string | null;
  issuedDate: string | null;
  linkedSaleIds: string[];
  uploadedBy: string;
  uploadedAt: string;
  notes: string | null;
}

export interface PurchaseRow {
  id: string;
  saleNumber: string;
  saleDate: string;
  status: string;
  itemCount: number;
  grandTotal: number;
  methods: string[];
}

export interface CustomerTag {
  id: string;
  name: string;
  color: string | null;
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
}

export const customersApi = {
  list: (params: Record<string, string | number | undefined | null>) => apiClient.get<CustomerRow[]>(`/customers${qs(params)}`),
  search: (q: string) => apiClient.get<Array<{ id: string; name: string; phone: string; hasPrescriptionOnFile: boolean }>>(`/customers/search${qs({ q })}`),
  detail: (id: string) => apiClient.get<CustomerDetail>(`/customers/${id}`),
  create: (body: Record<string, unknown>) => apiClient.post<CustomerDetail>('/customers', body),
  update: (id: string, body: Record<string, unknown>) => apiClient.put<CustomerDetail>(`/customers/${id}`, body),
  archive: (id: string) => apiClient.post<{ id: string }>(`/customers/${id}/archive`),
  checkDuplicate: (body: { phone?: string; name?: string; dateOfBirth?: string }) => apiClient.post<{ hardDuplicate: { id: string; name: string; phone: string } | null; softDuplicates: Array<{ id: string; name: string; phone: string }> }>('/customers/check-duplicate', body),
  merge: (survivingId: string, mergedAwayId: string) => apiClient.post<{ reassignedSales: number }>('/customers/merge', { survivingId, mergedAwayId }),
  purchaseHistory: (id: string, page = 1) => apiClient.get<PurchaseRow[]>(`/customers/${id}/purchase-history${qs({ page })}`),
  medicationSummary: (id: string) => apiClient.get<Array<{ medicineId: string; medicineName: string; totalQuantity: number; lastPurchased: string }>>(`/customers/${id}/medication-summary`),
  healthProfile: (id: string) => apiClient.get<HealthProfile>(`/customers/${id}/health-profile`),
  updateHealthProfile: (id: string, body: Record<string, unknown>) => apiClient.put<HealthProfile>(`/customers/${id}/health-profile`, body),
  prescriptions: (id: string) => apiClient.get<PrescriptionRow[]>(`/customers/${id}/prescriptions`),
  addPrescription: (id: string, body: Record<string, unknown>) => apiClient.post<{ id: string }>(`/customers/${id}/prescriptions`, body),
  tags: () => apiClient.get<CustomerTag[]>('/customer-tags'),
  assignTag: (id: string, tagId: string) => apiClient.post<{ id: string }>(`/customers/${id}/tags`, { tagId }),
  removeTag: (id: string, tagId: string) => apiClient.delete(`/customers/${id}/tags/${tagId}`),
  addNote: (id: string, note: string) => apiClient.post<{ id: string }>(`/customers/${id}/notes`, { note }),
};
