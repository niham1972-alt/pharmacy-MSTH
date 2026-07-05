import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { InventoryService } from './inventory.service';
import { SubmitReconciliationDto } from './dto/inventory.dto';

/**
 * Physical-count reconciliation. Submitting a count is INFORMATIONAL — it never
 * mutates stock (spec §11). Only a resulting Stock Adjustment (Module 11) does,
 * keeping the "who authorized this stock change" line auditable. This exposes
 * the expected-vs-counted variance for Module 11 to consume.
 */
@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditLogService,
  ) {}

  private branch(user: AuthenticatedUser, requested?: string): string {
    const branchId = requested ?? user.branchId;
    if (!user.accessibleBranchIds.includes(branchId)) throw new ForbiddenException({ errorCode: 'BRANCH_ACCESS_DENIED', message: `No access to branch ${branchId}` });
    return branchId;
  }

  async submit(user: AuthenticatedUser, dto: SubmitReconciliationDto) {
    const branchId = this.branch(user, dto.branchId);
    const expectedQuantity = await this.inventory.getCurrentStock({ pharmacyId: user.pharmacyId, branchId, medicineId: dto.medicineId });
    const variance = dto.countedQuantity - expectedQuantity;
    const rec = await this.prisma.stockReconciliation.create({
      data: { pharmacyId: user.pharmacyId, branchId, medicineId: dto.medicineId, expectedQuantity, countedQuantity: dto.countedQuantity, variance, countedBy: user.userId, notes: dto.notes },
    });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId, userId: user.userId, action: 'RECONCILIATION_SUBMITTED', entityType: 'STOCK_RECONCILIATION', entityId: rec.id, metadata: { expectedQuantity, countedQuantity: dto.countedQuantity, variance } });
    return { id: rec.id, expectedQuantity, countedQuantity: dto.countedQuantity, variance };
  }

  async list(user: AuthenticatedUser, branchId?: string) {
    const scope = this.branch(user, branchId);
    const rows = await this.prisma.stockReconciliation.findMany({ where: { pharmacyId: user.pharmacyId, branchId: scope }, orderBy: { countedAt: 'desc' }, take: 100 });
    const medIds = [...new Set(rows.map((r) => r.medicineId))];
    const meds = await this.prisma.medicine.findMany({ where: { id: { in: medIds } }, select: { id: true, genericName: true, brandName: true } });
    const nameOf = new Map(meds.map((m) => [m.id, m.brandName ?? m.genericName]));
    return rows.map((r) => ({ id: r.id, medicineId: r.medicineId, name: nameOf.get(r.medicineId) ?? r.medicineId, expectedQuantity: r.expectedQuantity, countedQuantity: r.countedQuantity, variance: r.variance, countedAt: r.countedAt.toISOString(), resolved: !!r.resolvedByAdjustmentId }));
  }
}
