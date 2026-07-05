import { apiClient } from '../../../shared/api/client';

export type BatchStatus = 'FRESH' | 'EXPIRING_SOON' | 'EXPIRED' | 'DEPLETED' | 'RECALLED';
export type ExpiryTier = 'red' | 'orange' | 'yellow' | 'fresh';

export interface BatchRow {
  id: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  daysToExpiry: number;
  currentQuantity: number;
  status: BatchStatus;
  isRecalled: boolean;
  tier: ExpiryTier;
  branchId: string;
  receivedDate: string;
}

export interface BatchDetail extends BatchRow {
  receivedQuantity: number;
  unitCostAtReceipt: number;
  manufactureDate: string | null;
  expiryOverridden: boolean;
  expiryOverrideReason: string | null;
  sourceGrnId: string | null;
  createdAt: string;
  linkedSales: Array<{ saleId: string; saleNumber: string; saleDate: string; status: string; quantity: number }>;
  writeOffs: Array<{ id: string; quantity: number; disposalMethod: string; disposalReference: string | null; writtenOffBy: string; writtenOffAt: string; notes: string | null }>;
  recalls: Array<{ id: string; reason: string; sourceReference: string | null; resolutionStatus: string; flaggedAt: string; resolvedAt: string | null }>;
}

export interface ExpiringResponse {
  thresholdDays: number;
  counts: { red: number; orange: number; yellow: number };
  items: BatchRow[];
}

export interface RecallRow {
  id: string;
  batchId: string;
  batchNumber: string;
  medicineName: string;
  quantityAffected: number;
  reason: string;
  sourceReference: string | null;
  flaggedBy: string;
  flaggedAt: string;
  resolutionStatus: string;
  resolvedAt: string | null;
}

export interface WriteOffHistoryRow {
  id: string;
  batchId: string;
  batchNumber: string;
  medicineName: string;
  quantityWrittenOff: number;
  disposalMethod: string;
  disposalReference: string | null;
  writtenOffBy: string;
  writtenOffAt: string;
  notes: string | null;
}

export interface AffectedSale {
  saleId: string;
  saleNumber: string;
  saleDate: string;
  status: string;
  customerId: string | null;
  quantity: number;
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
}

export interface WriteOffPayload {
  batches: Array<{ batchId: string; quantity: number }>;
  disposalMethod: string;
  disposalReference?: string;
  notes?: string;
}

export const batchesApi = {
  list: (params: Record<string, string | number | undefined | null>) => apiClient.get<BatchRow[]>(`/batches${qs(params)}`),
  detail: (id: string) => apiClient.get<BatchDetail>(`/batches/${id}`),
  expiring: (thresholdDays?: number, branchId?: string | null) => apiClient.get<ExpiringResponse>(`/batches/expiring${qs({ thresholdDays, branchId })}`),
  expired: (branchId?: string | null) => apiClient.get<BatchRow[]>(`/batches/expired${qs({ branchId })}`),
  writeOff: (body: WriteOffPayload) => apiClient.post<{ writtenOff: number }>('/batches/write-off', body),
  writeOffHistory: (branchId?: string | null) => apiClient.get<WriteOffHistoryRow[]>(`/batches/write-offs${qs({ branchId })}`),
  recallList: () => apiClient.get<RecallRow[]>('/batches/recalls'),
  flagRecall: (id: string, body: { reason: string; sourceReference?: string; notes?: string }) => apiClient.post<{ id: string; alreadyRecalled: boolean }>(`/batches/${id}/recall`, body),
  resolveRecall: (id: string, body: { resolutionStatus: string; notes?: string }) => apiClient.post<{ resolved: boolean }>(`/batches/recalls/${id}/resolve`, body),
  affectedSales: (id: string) => apiClient.get<AffectedSale[]>(`/batches/recalls/${id}/affected-sales`),
};
