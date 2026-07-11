export type RefundMethod = 'CASH' | 'CARD' | 'STORE_CREDIT' | 'EXCHANGE' | 'NO_REFUND';
export type ConditionAssessment = 'RESALEABLE' | 'NOT_RESALEABLE';
export type ReturnReasonCode = 'CUSTOMER_CHANGED_MIND' | 'INCORRECT_ITEM_DISPENSED' | 'ADVERSE_REACTION' | 'DAMAGED_DEFECTIVE' | 'PRESCRIPTION_CHANGED' | 'OTHER';

export const REASON_LABELS: Record<ReturnReasonCode, string> = {
  CUSTOMER_CHANGED_MIND: 'Customer changed mind',
  INCORRECT_ITEM_DISPENSED: 'Incorrect item dispensed',
  ADVERSE_REACTION: 'Adverse reaction',
  DAMAGED_DEFECTIVE: 'Damaged / defective',
  PRESCRIPTION_CHANGED: 'Prescription changed',
  OTHER: 'Other',
};
export const REFUND_LABELS: Record<RefundMethod, string> = {
  CASH: 'Cash refund',
  CARD: 'Card reversal',
  STORE_CREDIT: 'Store credit',
  EXCHANGE: 'Exchange',
  NO_REFUND: 'No refund (documentation only)',
};

export interface EligibilityLine {
  saleItemId: string;
  medicineId: string;
  name: string;
  batchId: string | null;
  purchasedQuantity: number;
  alreadyReturnedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  maxRefundForRemaining: number;
  prescriptionRequired: boolean;
  controlled: boolean;
  eligible: boolean;
  ineligibleReason: string | null;
  requiresApproval: boolean;
}
export interface EligibilityResult {
  saleId: string;
  saleNumber: string;
  saleDate: string;
  status: string;
  customerId: string | null;
  withinWindow: boolean;
  windowDays: number;
  anyEligible: boolean;
  lines: EligibilityLine[];
}

export interface CreateReturnLine {
  originalSaleItemId: string;
  quantityReturned: number;
  conditionAssessment: ConditionAssessment;
  reasonCode: ReturnReasonCode;
  reasonNote?: string;
  conditionPhotoUrl?: string;
}
export interface CreateReturnPayload {
  originalSaleId: string;
  refundMethod: RefundMethod;
  refundReference?: string;
  exchangeSaleId?: string;
  notes?: string;
  stepUpId?: string;
  items: CreateReturnLine[];
}

export interface SalesReturnListRow {
  id: string;
  returnNumber: string;
  originalSaleId: string;
  returnDate: string;
  customerId: string | null;
  processedBy: string;
  approvedBy: string | null;
  totalRefundAmount: number;
  refundMethod: RefundMethod;
  itemCount: number;
}
export interface SalesReturnItemDetail {
  id: string;
  medicineId: string;
  name: string;
  sku: string | null;
  batchId: string | null;
  quantityReturned: number;
  unitPriceAtSale: number;
  refundAmountForLine: number;
  conditionAssessment: ConditionAssessment;
  reasonCode: ReturnReasonCode;
  reasonNote: string | null;
  conditionPhotoUrl: string | null;
  restoredToStock: boolean;
  flaggedForReview: boolean;
}
export interface SalesReturnDetail {
  id: string;
  returnNumber: string;
  originalSaleId: string;
  originalSaleNumber: string | null;
  originalSaleDate: string | null;
  returnDate: string;
  branchId: string;
  customerId: string | null;
  processedBy: string;
  approvedBy: string | null;
  totalRefundAmount: number;
  refundMethod: RefundMethod;
  refundReference: string | null;
  exchangeSaleId: string | null;
  notes: string | null;
  items: SalesReturnItemDetail[];
}

export interface ReturnRateByMedicine {
  medicineId: string;
  name: string;
  returnedQuantity: number;
  soldQuantity: number;
  returnCount: number;
  totalRefunded: number;
  returnRatePercent: number | null;
}
export interface ReturnRateByReason {
  reasonCode: ReturnReasonCode;
  lineCount: number;
  returnedQuantity: number;
  totalRefunded: number;
}
export interface StoreCredit {
  customerId: string;
  balance: number;
  ledger?: Array<{ id: string; direction: string; amount: number; balanceAfter: number; referenceModule: string; referenceId: string; createdAt: string }>;
}
