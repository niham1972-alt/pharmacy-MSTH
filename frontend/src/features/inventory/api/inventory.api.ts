import { apiClient } from '../../../shared/api/client';

export interface InventoryRow {
  medicineId: string;
  name: string;
  sku: string;
  category: string | null;
  currentStock: number;
  reorderLevel: number;
  stockStatus: 'in_stock' | 'low' | 'out';
  lastMovementAt: string;
  unitCost?: number;
  stockValue?: number;
}

export interface InventoryDetail extends InventoryRow {
  reorderQuantity: number;
  batches: Array<{ id: string; batchNumber: string; quantity: number; expiryDate: string }>;
}

export interface LedgerEntry {
  id: string;
  direction: 'IN' | 'OUT';
  quantity: number;
  reasonCode: string;
  referenceModule: string;
  referenceId: string;
  balanceAfter: number;
  performedBy: string;
  notes: string | null;
  createdAt: string;
}

export interface ReorderSuggestion {
  medicineId: string;
  name: string;
  sku: string;
  currentStock: number;
  reorderLevel: number;
  suggestedQuantity: number;
  stockStatus: string;
}

function qs(params: object): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
}

export const inventoryApi = {
  list: (params: Record<string, string | number | undefined | null>) => apiClient.get<InventoryRow[]>(`/inventory${qs(params)}`),
  detail: (medicineId: string, branchId?: string | null) => apiClient.get<InventoryDetail>(`/inventory/${medicineId}${qs({ branchId })}`),
  ledger: (medicineId: string, page = 1, branchId?: string | null) => apiClient.get<LedgerEntry[]>(`/inventory/${medicineId}/ledger${qs({ page, limit: 30, branchId })}`),
  summary: (branchId?: string | null) => apiClient.get<{ totalSkus: number; totalStockValue: number; lowStockCount: number; outOfStockCount: number }>(`/inventory/summary${qs({ branchId })}`),
  reorderSuggestions: (branchId?: string | null) => apiClient.get<ReorderSuggestion[]>(`/inventory/reorder-suggestions${qs({ branchId })}`),
  valuation: (branchId?: string | null) => apiClient.get<{ grandTotalValue: number; byCategory: Array<{ category: string; quantity: number; value: number }> }>(`/inventory/valuation${qs({ branchId })}`),
  reconcile: (body: { medicineId: string; countedQuantity: number; notes?: string }) => apiClient.post<{ expectedQuantity: number; countedQuantity: number; variance: number }>('/inventory/reconciliation', body),
  reconciliationList: (branchId?: string | null) => apiClient.get<Array<{ id: string; medicineId?: string; name: string; expectedQuantity: number; countedQuantity: number; variance: number; countedAt: string; resolved: boolean }>>(`/inventory/reconciliation${qs({ branchId })}`),
};
