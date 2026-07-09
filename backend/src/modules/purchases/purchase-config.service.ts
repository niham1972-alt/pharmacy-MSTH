import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

export type CostingRule = 'LATEST_COST' | 'WEIGHTED_AVERAGE' | 'MANUAL_ONLY';

export interface PurchaseConfig {
  autoApproveThreshold: number; // PO grandTotal at/under which submit auto-approves
  overReceiptTolerancePercent: number; // extra % receivable beyond ordered qty
  varianceWarnPercent: number; // soft warning threshold on cost variance
  varianceBlockPercent: number; // hard-block threshold requiring acknowledgement
  costingRule: CostingRule;
}

/**
 * Purchase business rules, now resolved LIVE from Module 18 Settings (per-pharmacy,
 * per-branch, admin-editable) instead of env vars. The approval threshold is a
 * BRANCH-scoped setting; the rest are pharmacy-wide.
 */
@Injectable()
export class PurchaseConfigService {
  constructor(private readonly settings: SettingsService) {}

  async get(pharmacyId: string, branchId?: string): Promise<PurchaseConfig> {
    const s = await this.settings.getMany(
      ['purchases.approval.thresholdAmount', 'purchases.receipt.overReceiptTolerancePercent', 'purchases.variance.warnPercent', 'purchases.variance.blockPercent', 'purchases.costingRule'],
      { pharmacyId, branchId },
    );
    return {
      autoApproveThreshold: s['purchases.approval.thresholdAmount'] as number,
      overReceiptTolerancePercent: s['purchases.receipt.overReceiptTolerancePercent'] as number,
      varianceWarnPercent: s['purchases.variance.warnPercent'] as number,
      varianceBlockPercent: s['purchases.variance.blockPercent'] as number,
      costingRule: s['purchases.costingRule'] as CostingRule,
    };
  }
}
