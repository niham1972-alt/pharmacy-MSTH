import { apiClient } from '../../../shared/api/client';
import {
  Lookup,
  MedicineDetail,
  MedicineFormValues,
  MedicineListItem,
  MedicineSearchResult,
  Paginated,
  PriceHistoryEntry,
} from '../types/medicine.types';

export interface MedicineListParams {
  page?: number;
  limit?: number;
  search?: string;
  branchId?: string | null;
  categoryId?: string;
  manufacturerId?: string;
  dosageFormId?: string;
  status?: string;
  stockStatus?: string;
  sortBy?: string;
  sortOrder?: string;
}

function qs(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

export const medicinesApi = {
  list: (params: MedicineListParams) =>
    apiClient.get<MedicineListItem[]>(`/medicines${qs(params)}`),

  getById: (id: string) => apiClient.get<MedicineDetail>(`/medicines/${id}`),

  search: (q: string, branchId?: string | null, limit = 20) =>
    apiClient.get<MedicineSearchResult[]>(`/medicines/search${qs({ q, branchId, limit })}`),

  priceHistory: (id: string) => apiClient.get<PriceHistoryEntry[]>(`/medicines/${id}/price-history`),

  checkDuplicate: (body: { genericName: string; strength?: string; manufacturerId: string; dosageFormId: string }) =>
    apiClient.post<{ isDuplicate: boolean; matches: unknown[] }>(`/medicines/check-duplicate`, body),

  create: (body: MedicineFormValues) => apiClient.post<MedicineDetail>('/medicines', body),

  update: (id: string, body: Partial<MedicineFormValues> & { priceChangeReason?: string }) =>
    apiClient.put<MedicineDetail>(`/medicines/${id}`, body),

  changeStatus: (id: string, status: string, reason?: string) =>
    apiClient.patch<{ id: string; status: string }>(`/medicines/${id}/status`, { status, reason }),

  archive: (id: string) => apiClient.post<{ id: string }>(`/medicines/${id}/archive`),

  remove: (id: string) => apiClient.delete<{ id: string }>(`/medicines/${id}`),

  addBarcode: (id: string, barcode: string, isPrimary = false) =>
    apiClient.post(`/medicines/${id}/barcodes`, { barcode, isPrimary }),

  removeBarcode: (id: string, barcodeId: string) => apiClient.delete(`/medicines/${id}/barcodes/${barcodeId}`),
};

export const lookupsApi = {
  categories: () => apiClient.get<Lookup[]>('/medicine-categories'),
  manufacturers: () => apiClient.get<Lookup[]>('/medicine-manufacturers'),
  dosageForms: () => apiClient.get<Lookup[]>('/medicine-dosage-forms'),
  units: () => apiClient.get<Lookup[]>('/medicine-units'),
  racks: () => apiClient.get<Lookup[]>('/medicine-racks'),

  create: (kind: LookupKind, body: Record<string, unknown>) => apiClient.post<Lookup>(lookupPath(kind), body),
  update: (kind: LookupKind, id: string, body: Record<string, unknown>) => apiClient.put<Lookup>(`${lookupPath(kind)}/${id}`, body),
  remove: (kind: LookupKind, id: string) => apiClient.delete(`${lookupPath(kind)}/${id}`),
};

export type LookupKind = 'categories' | 'manufacturers' | 'dosageForms' | 'units' | 'racks';

export function lookupPath(kind: LookupKind): string {
  switch (kind) {
    case 'categories':
      return '/medicine-categories';
    case 'manufacturers':
      return '/medicine-manufacturers';
    case 'dosageForms':
      return '/medicine-dosage-forms';
    case 'units':
      return '/medicine-units';
    case 'racks':
      return '/medicine-racks';
  }
}
