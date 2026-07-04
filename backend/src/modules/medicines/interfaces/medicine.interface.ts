export interface PaginatedResult<T> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  data: T[];
}

/** Lean shape returned by the POS-facing typeahead (spec §18). */
export interface MedicineSearchResult {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  taxRatePercent: number;
  primaryBarcode: string | null;
  imageUrl: string | null;
  currentStock: number;
  stockStatus: 'in_stock' | 'low' | 'out';
  taxRatePercent: number;
  taxInclusive: boolean;
  prescriptionRequired: boolean;
  controlled: boolean;
  discontinued: boolean;
  costPrice?: number; // redacted for cashier
}
