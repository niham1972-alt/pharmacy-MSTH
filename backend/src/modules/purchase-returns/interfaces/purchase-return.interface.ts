export interface ReturnableLine {
  grnItemId: string;
  medicineId: string;
  name: string;
  batchNumber: string;
  batchId: string | null; // resolved Module 6 batch
  expiryDate: string;
  receivedQuantity: number;
  alreadyReturnedQuantity: number;
  remainingQuantity: number;
  currentBatchStock: number | null; // live sellable stock in that batch (spec §21 guard)
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
