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
