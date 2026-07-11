export type SettlementStatus = 'PENDING' | 'CREDITED' | 'PARTIALLY_CREDITED' | 'REJECTED';
export type PurchaseReturnReason = 'NEAR_EXPIRY' | 'DAMAGED_DEFECTIVE' | 'WRONG_ITEM_SHIPPED' | 'QUALITY_RECALL' | 'EXCESS_STOCK' | 'OTHER';

export const REASON_LABELS: Record<PurchaseReturnReason, string> = {
  NEAR_EXPIRY: 'Near expiry (supplier agreement)',
  DAMAGED_DEFECTIVE: 'Damaged / defective',
  WRONG_ITEM_SHIPPED: 'Wrong item shipped',
  QUALITY_RECALL: 'Quality / recall',
  EXCESS_STOCK: 'Excess stock',
  OTHER: 'Other',
};
export const SETTLEMENT_LABELS: Record<SettlementStatus, string> = {
  PENDING: 'Pending',
  CREDITED: 'Credited',
  PARTIALLY_CREDITED: 'Partially credited',
  REJECTED: 'Rejected',
};

export interface ReturnableLine {
  grnItemId: string;
  medicineId: string;
  name: string;
  batchNumber: string;
  batchId: string | null;
  expiryDate: string;
  receivedQuantity: number;
  alreadyReturnedQuantity: number;
  remainingQuantity: number;
  currentBatchStock: number | null;
  unitCostAtReceipt: number;
}
export interface ReturnableResult {
  grnId: string;
  grnNumber: string;
  receivedDate: string;
  supplierId: string;
  supplierName: string | null;
  poNumber: string | null;
  anyReturnable: boolean;
  lines: ReturnableLine[];
}

export interface CreateReturnLine {
  originalGrnItemId: string;
  quantityReturned: number;
  reasonCode: PurchaseReturnReason;
  reasonNote?: string;
  relatedRecallId?: string;
  photoUrl?: string;
}
export interface CreateReturnPayload {
  originalGrnId: string;
  expectedCreditAmount?: number;
  notes?: string;
  items: CreateReturnLine[];
}

export interface PurchaseReturnListRow {
  id: string;
  returnNumber: string;
  originalGrnId: string;
  supplierId: string;
  supplierName: string | null;
  returnDate: string;
  settlementStatus: SettlementStatus;
  expectedCreditAmount: number;
  actualCreditedAmount: number | null;
  itemCount: number;
  ageDays: number | null;
}
export interface PurchaseReturnItemDetail {
  id: string;
  medicineId: string;
  name: string;
  sku: string | null;
  batchId: string | null;
  quantityReturned: number;
  unitCostAtReceipt: number;
  lineCredit: number;
  reasonCode: PurchaseReturnReason;
  reasonNote: string | null;
  relatedRecallId: string | null;
  photoUrl: string | null;
}
export interface PurchaseReturnDetail {
  id: string;
  returnNumber: string;
  originalGrnId: string;
  originalGrnNumber: string | null;
  supplierId: string;
  supplierName: string | null;
  branchId: string;
  returnDate: string;
  settlementStatus: SettlementStatus;
  expectedCreditAmount: number;
  actualCreditedAmount: number | null;
  creditVariance: number | null;
  supplierCreditNoteRef: string | null;
  settledAt: string | null;
  settledBy: string | null;
  initiatedBy: string;
  notes: string | null;
  items: PurchaseReturnItemDetail[];
}
