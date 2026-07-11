import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../../../common/audit/audit-log.interface';

/**
 * NOT_RESALEABLE returns still refund the customer, but their stock must NOT
 * rejoin sellable inventory. Rather than fabricate a disposal decision (Module 6's
 * BatchWriteOff needs a real disposalMethod chosen by staff), this records the
 * units as quarantined/pending-disposal so they never silently vanish from the
 * accounting trail — leaving the actual write-off as a deliberate Module 6 action.
 */
@Injectable()
export class BatchWriteoffTriggerService {
  constructor(private readonly audit: AuditLogService) {}

  async quarantine(params: { pharmacyId: string; branchId: string; salesReturnId: string; performedBy: string; items: Array<{ medicineId: string; batchId: string | null; quantity: number }> }): Promise<void> {
    for (const it of params.items) {
      await this.audit.record({
        pharmacyId: params.pharmacyId,
        branchId: params.branchId,
        userId: params.performedBy,
        action: 'RETURN_ITEM_QUARANTINED',
        entityType: 'SALES_RETURN',
        entityId: params.salesReturnId,
        severity: 'SENSITIVE',
        metadata: { medicineId: it.medicineId, batchId: it.batchId, quantity: it.quantity, disposition: 'NOT_RESALEABLE — pending Module 6 write-off/disposal' },
      });
    }
  }
}
