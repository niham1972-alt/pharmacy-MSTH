export type AdjustmentDirection = 'INCREASE' | 'DECREASE';
export type AdjustmentReasonCode =
  | 'PHYSICAL_COUNT_CORRECTION' | 'DAMAGED_BREAKAGE' | 'THEFT_LOSS_SUSPECTED'
  | 'DATA_ENTRY_CORRECTION' | 'EXPIRED_FOUND_OUTSIDE_PROCESS' | 'OTHER';
export type AdjustmentStatus = 'AUTO_APPROVED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export const REASON_LABELS: Record<AdjustmentReasonCode, string> = {
  PHYSICAL_COUNT_CORRECTION: 'Physical count correction',
  DAMAGED_BREAKAGE: 'Damaged / breakage',
  THEFT_LOSS_SUSPECTED: 'Theft / loss suspected',
  DATA_ENTRY_CORRECTION: 'Data-entry correction',
  EXPIRED_FOUND_OUTSIDE_PROCESS: 'Expired found (outside normal process)',
  OTHER: 'Other',
};

export interface CreateAdjustmentInput {
  medicineId: string;
  batchId?: string;
  branchId?: string;
  direction: AdjustmentDirection;
  quantity: number;
  reasonCode: AdjustmentReasonCode;
  reasonNote?: string;
  evidenceUrl?: string;
  linkedReconciliationId?: string;
}

export interface Adjustment {
  id: string;
  adjustmentNumber: string;
  medicineId: string;
  medicineName?: string;
  batchId: string | null;
  direction: AdjustmentDirection;
  quantity: number;
  unitCostAtRequest: number;
  value: number;
  reasonCode: AdjustmentReasonCode;
  reasonNote: string | null;
  evidenceUrl: string | null;
  linkedReconciliationId: string | null;
  status: AdjustmentStatus;
  requestedBy: string;
  requestedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
}

export interface AdjustmentDetail extends Adjustment {
  reconciliation: { id: string; expectedQuantity: number; countedQuantity: number; variance: number; countedAt: string } | null;
}

export interface BulkResult {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{ index: number; success: boolean; adjustmentNumber?: string; status?: string; error?: string }>;
}

export interface ShrinkageBucket { key: string; id: string; quantity: number; value: number; count: number }
export interface ShrinkageReport {
  totalNegativeQuantity: number;
  totalValue: number;
  byReason: ShrinkageBucket[];
  byMedicine: ShrinkageBucket[];
  byRequester: ShrinkageBucket[];
}
