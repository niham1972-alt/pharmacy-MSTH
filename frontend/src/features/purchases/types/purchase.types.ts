export type POStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED' | 'CANCELLED' | 'REJECTED';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  paymentTermsDays: number;
}

export interface POListItem {
  id: string;
  poNumber: string;
  supplier: { id: string; name: string };
  status: POStatus;
  paymentStatus: PaymentStatus;
  orderDate: string;
  expectedDeliveryDate: string | null;
  dueDate: string | null;
  itemCount: number;
  grandTotal: number;
  amountPaid: number;
  isDirectGrn: boolean;
}

export interface POItem {
  id: string;
  medicineId: string;
  medicineName: string;
  sku: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  expectedUnitCost: number;
  taxRatePercent: number;
  lineTotal: number;
}

export interface PODetail {
  id: string;
  poNumber: string;
  supplier: Supplier;
  status: POStatus;
  paymentStatus: PaymentStatus;
  orderDate: string;
  expectedDeliveryDate: string | null;
  dueDate: string | null;
  notes: string | null;
  subTotal: number;
  taxTotal: number;
  grandTotal: number;
  amountPaid: number;
  outstanding: number;
  isDirectGrn: boolean;
  approvedBy: string | null;
  rejectedReason: string | null;
  cancelledReason: string | null;
  items: POItem[];
  goodsReceipts: Array<{ id: string; grnNumber: string; receivedDate: string; hasVariance: boolean; itemCount: number }>;
  payments: Array<{ id: string; amount: number; method: string; paymentDate: string; referenceNumber: string | null }>;
}

export interface PendingApproval {
  id: string;
  poNumber: string;
  supplierName: string | null;
  grandTotal: number;
  itemCount: number;
  createdAt: string;
}

export interface PurchaseSummary {
  pendingOrders: number;
  overduePayablesCount: number;
  overduePayablesAmount: number;
  totalOutstanding: number;
}

export interface POLineInput {
  medicineId: string;
  medicineName?: string;
  orderedQuantity: number;
  expectedUnitCost: number;
  taxRatePercent?: number;
}

export type TaxDiscountMode = 'PERCENT' | 'AMOUNT';

export interface GrnLineInput {
  purchaseOrderItemId?: string;
  medicineId: string;
  medicineName?: string;
  orderedQuantity?: number;
  alreadyReceived?: number;
  receivedQuantity: number;
  looseUnitQuantity?: number;
  freeQuantity: number;
  batchNumber: string;
  expiryDate: string;
  actualUnitCost: number;
  expectedUnitCost?: number;
  rackId?: string;
  discountMode?: TaxDiscountMode;
  discountValue?: number;
  salesTaxMode?: TaxDiscountMode;
  salesTaxValue?: number;
  advanceTaxMode?: TaxDiscountMode;
  advanceTaxValue?: number;
  expiryOverridden?: boolean;
  expiryOverrideReason?: string;
}

export interface GrnInvoiceAdjustments {
  invoiceDiscountMode?: TaxDiscountMode;
  invoiceDiscountValue?: number;
  invoiceSalesTaxMode?: TaxDiscountMode;
  invoiceSalesTaxValue?: number;
  invoiceAdvanceTaxMode?: TaxDiscountMode;
  invoiceAdvanceTaxValue?: number;
}
