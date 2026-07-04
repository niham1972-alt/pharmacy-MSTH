import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type CostingRule = 'LATEST_COST' | 'WEIGHTED_AVERAGE' | 'MANUAL_ONLY';

export interface PurchaseConfig {
  autoApproveThreshold: number; // PO grandTotal at/under which submit auto-approves
  overReceiptTolerancePercent: number; // extra % receivable beyond ordered qty
  varianceWarnPercent: number; // soft warning threshold on cost variance
  varianceBlockPercent: number; // hard-block threshold requiring acknowledgement
  costingRule: CostingRule;
}

/**
 * Purchase business rules. These belong to Settings (Module 18) — sourced from
 * env vars with sane defaults for now, never hardcoded in service logic
 * (spec §22). Swapping this for a per-pharmacy Settings lookup is a one-method
 * change with no call-site impact.
 */
@Injectable()
export class PurchaseConfigService {
  constructor(private readonly config: ConfigService) {}

  get(): PurchaseConfig {
    return {
      autoApproveThreshold: this.num('PO_AUTO_APPROVE_THRESHOLD', 50000),
      overReceiptTolerancePercent: this.num('PO_OVER_RECEIPT_TOLERANCE_PCT', 0),
      varianceWarnPercent: this.num('PO_VARIANCE_WARN_PCT', 10),
      varianceBlockPercent: this.num('PO_VARIANCE_BLOCK_PCT', 50),
      costingRule: (this.config.get<string>('PO_COSTING_RULE') as CostingRule) ?? 'LATEST_COST',
    };
  }

  private num(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    const n = raw !== undefined ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : fallback;
  }
}
