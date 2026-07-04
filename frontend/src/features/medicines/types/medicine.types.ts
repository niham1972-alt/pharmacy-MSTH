export type MedicineStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
export type StockStatus = 'in_stock' | 'low' | 'out';

export interface LookupRef {
  id: string;
  name: string;
}

export interface Barcode {
  id: string;
  barcode: string;
  isPrimary: boolean;
}

export interface MedicineListItem {
  id: string;
  sku: string;
  genericName: string;
  brandName: string | null;
  name: string;
  strength: string | null;
  manufacturer: LookupRef;
  category: LookupRef;
  dosageForm: LookupRef;
  sellingPrice: number;
  mrp: number;
  taxRatePercent: number;
  prescriptionRequired: boolean;
  controlledSubstanceSchedule: string | null;
  status: MedicineStatus;
  isActive: boolean;
  currentStock: number;
  reorderLevel: number;
  stockStatus: StockStatus;
  imageUrl: string | null;
  primaryBarcode: string | null;
  updatedAt: string;
  costPrice?: number;
  margin?: number | null;
}

export interface MedicineDetail extends MedicineListItem {
  pharmacyId: string;
  branchId: string | null;
  isGlobalAcrossBranches: boolean;
  subCategoryId: string | null;
  routeOfAdministration: string | null;
  therapeuticClass: string | null;
  storageCondition: string | null;
  baseUnit: LookupRef;
  purchaseUnit: LookupRef;
  saleUnit: LookupRef;
  taxInclusive: boolean;
  discountEligible: boolean;
  reorderQuantity: number;
  maxStockLevel: number | null;
  documentUrl: string | null;
  barcodes: Barcode[];
  createdAt: string;
}

export interface PriceHistoryEntry {
  id: string;
  priceType: 'COST' | 'MRP' | 'SELLING';
  oldValue: number;
  newValue: number;
  changedBy: string;
  effectiveAt: string;
  reason: string | null;
}

export interface MedicineSearchResult {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  taxRatePercent: number;
  taxInclusive?: boolean;
  prescriptionRequired?: boolean;
  controlled?: boolean;
  discontinued?: boolean;
  primaryBarcode: string | null;
  imageUrl: string | null;
  currentStock: number;
  stockStatus: StockStatus;
  costPrice?: number;
}

export interface Paginated<T> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  data: T[];
}

export interface MedicineFormValues {
  genericName: string;
  brandName?: string;
  sku?: string;
  manufacturerId: string;
  categoryId: string;
  dosageFormId: string;
  baseUnitId: string;
  purchaseUnitId: string;
  saleUnitId: string;
  strength?: string;
  routeOfAdministration?: string;
  therapeuticClass?: string;
  storageCondition?: string;
  prescriptionRequired?: boolean;
  controlledSubstanceSchedule?: string;
  costPrice?: number;
  mrp?: number;
  sellingPrice?: number;
  taxRatePercent?: number;
  reorderLevel?: number;
  reorderQuantity?: number;
  maxStockLevel?: number;
  currentStock?: number;
  barcodes?: string[];
  confirmNegativeMargin?: boolean;
  confirmDuplicate?: boolean;
}

export interface Lookup {
  id: string;
  name: string;
  symbol?: string | null;
  country?: string | null;
  parentId?: string | null;
  isActive?: boolean;
}
