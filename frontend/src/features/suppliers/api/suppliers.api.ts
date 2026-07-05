import { apiClient } from '../../../shared/api/client';

export type SupplierType = 'MANUFACTURER' | 'DISTRIBUTOR' | 'WHOLESALER' | 'LOCAL_VENDOR';
export type LicenseStatus = 'none' | 'valid' | 'expiring' | 'expired';

export interface SupplierRow {
  id: string;
  companyName: string;
  tradingName: string | null;
  supplierType: SupplierType;
  isActive: boolean;
  paymentTermsCode: string;
  currency: string;
  licenseStatus: LicenseStatus;
  licenseDaysToExpiry: number | null;
  totalSpend: number;
  outstanding: number;
}

export interface SupplierContact {
  id: string;
  name: string;
  designation: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
}

export interface SupplierDetail {
  id: string;
  companyName: string;
  tradingName: string | null;
  supplierType: SupplierType;
  taxRegistrationNumber: string | null;
  drugLicenseNumber: string | null;
  drugLicenseExpiry: string | null;
  licenseStatus: LicenseStatus;
  licenseDaysToExpiry: number | null;
  paymentTermsCode: string;
  currency: string;
  bankAccountDetails?: Record<string, unknown> | null;
  notes: string | null;
  isActive: boolean;
  contacts: SupplierContact[];
  addresses: Array<{ id: string; type: string; addressLine1: string; addressLine2: string | null; city: string | null; state: string | null; country: string | null; postalCode: string | null }>;
  documents: Array<{ id: string; documentType: string; fileUrl: string; expiryDate: string | null; status: LicenseStatus; daysToExpiry: number | null }>;
  pricing: Array<{ id: string; medicineId: string; medicineName: string; negotiatedCost: number; effectiveFrom: string; effectiveTo: string | null }>;
}

export interface Performance {
  totalPos: number;
  totalSpend: number;
  grnCount: number;
  onTimeRate: number | null;
  varianceRate: number | null;
  varianceIncidents: number;
  avgPaymentTurnaroundDays: number | null;
}

export interface Payables {
  totalOutstanding: number;
  oldestUnpaidAgeDays: number;
  overdueCount: number;
  items: Array<{ purchaseOrderId: string; poNumber: string; grandTotal: number; amountPaid: number; outstanding: number; dueDate: string | null; ageDays: number; overdue: boolean; paymentStatus: string }>;
}

export interface NeedingAttention {
  licenseRisk: Array<{ id: string; companyName: string; drugLicenseNumber: string | null; drugLicenseExpiry: string | null; status: LicenseStatus; daysToExpiry: number | null }>;
  overduePayables: Array<{ supplierId: string; companyName: string; isActive: boolean; openPoCount: number; outstanding: number }>;
}

export interface CreateSupplierInput {
  companyName: string;
  tradingName?: string;
  supplierType: SupplierType;
  taxRegistrationNumber?: string;
  drugLicenseNumber?: string;
  drugLicenseExpiry?: string;
  paymentTermsCode: string;
  currency?: string;
  bankAccountDetails?: Record<string, unknown>;
  notes?: string;
  contacts?: Array<{ name: string; designation?: string; phone?: string; email?: string; isPrimary?: boolean }>;
  addresses?: Array<{ type: string; addressLine1: string; city?: string; country?: string }>;
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
}

export const suppliersApi = {
  list: (params: Record<string, string | number | undefined | null>) => apiClient.get<SupplierRow[]>(`/suppliers${qs(params)}`),
  active: () => apiClient.get<Array<{ id: string; name: string; companyName: string; paymentTermsCode: string }>>('/suppliers/active'),
  detail: (id: string) => apiClient.get<SupplierDetail>(`/suppliers/${id}`),
  create: (body: CreateSupplierInput) => apiClient.post<SupplierDetail>('/suppliers', body),
  update: (id: string, body: Partial<CreateSupplierInput>) => apiClient.put<SupplierDetail>(`/suppliers/${id}`, body),
  archive: (id: string) => apiClient.post<{ id: string }>(`/suppliers/${id}/archive`),
  remove: (id: string) => apiClient.delete<{ id: string }>(`/suppliers/${id}`),
  addContact: (id: string, body: { name: string; designation?: string; phone?: string; email?: string; isPrimary?: boolean }) => apiClient.post<{ id: string }>(`/suppliers/${id}/contacts`, body),
  removeContact: (id: string, contactId: string) => apiClient.delete<{ id: string }>(`/suppliers/${id}/contacts/${contactId}`),
  addDocument: (id: string, body: { documentType: string; fileUrl: string; expiryDate?: string }) => apiClient.post<{ id: string }>(`/suppliers/${id}/documents`, body),
  setPrice: (id: string, body: { medicineId: string; negotiatedCost: number; effectiveFrom?: string; effectiveTo?: string }) => apiClient.post<{ id: string }>(`/suppliers/${id}/pricing`, body),
  performance: (id: string) => apiClient.get<Performance>(`/suppliers/${id}/performance`),
  payables: (id: string) => apiClient.get<Payables>(`/suppliers/${id}/payables`),
  needingAttention: () => apiClient.get<NeedingAttention>('/suppliers/needing-attention'),
};

export const PAYMENT_TERMS = [
  { code: 'NET_15', label: 'Net 15' },
  { code: 'NET_30', label: 'Net 30' },
  { code: 'NET_45', label: 'Net 45' },
  { code: 'NET_60', label: 'Net 60' },
  { code: 'COD', label: 'Cash on Delivery' },
  { code: 'ADVANCE', label: 'Advance Payment' },
];

export const SUPPLIER_TYPES: SupplierType[] = ['MANUFACTURER', 'DISTRIBUTOR', 'WHOLESALER', 'LOCAL_VENDOR'];
