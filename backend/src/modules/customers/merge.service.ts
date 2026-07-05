import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CustomerEventsEmitter } from './events/customer-events.emitter';
import { MergeCustomersDto } from './dto/customers.dto';

/**
 * Transactional duplicate-merge. A customer merge is fundamentally a cross-
 * cutting identity operation, so it reassigns `Sale.customerId` (Module 4's
 * table) — a documented, explicitly-justified exception to "modules write only
 * their own tables". All-or-nothing: either every reference moves or nothing does.
 * Irreversible by design — `isMergedInto` permanently marks the merged-away record.
 */
@Injectable()
export class MergeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: CustomerEventsEmitter,
  ) {}

  async merge(user: AuthenticatedUser, dto: MergeCustomersDto) {
    if (dto.survivingId === dto.mergedAwayId) throw new BadRequestException({ errorCode: 'CANNOT_MERGE_SELF', message: 'Cannot merge a customer into itself.' });
    const [surviving, mergedAway] = await Promise.all([
      this.prisma.customer.findFirst({ where: { id: dto.survivingId, pharmacyId: user.pharmacyId } }),
      this.prisma.customer.findFirst({ where: { id: dto.mergedAwayId, pharmacyId: user.pharmacyId } }),
    ]);
    if (!surviving || !mergedAway) throw new NotFoundException({ errorCode: 'CUSTOMER_NOT_FOUND', message: 'One or both customers not found.' });
    if (surviving.isMergedInto || mergedAway.isMergedInto) throw new BadRequestException({ errorCode: 'ALREADY_MERGED', message: 'Cannot merge an already-merged record. Merge active records only.' });

    const reassignedSales = await this.prisma.$transaction(async (tx) => {
      // 1. Reassign Module 4 sales (cross-module write — justified for identity merge).
      const sales = await tx.sale.updateMany({ where: { pharmacyId: user.pharmacyId, customerId: dto.mergedAwayId }, data: { customerId: dto.survivingId } });
      // 2. Move prescriptions + notes wholesale.
      await tx.prescriptionRecord.updateMany({ where: { customerId: dto.mergedAwayId }, data: { customerId: dto.survivingId } });
      await tx.customerNote.updateMany({ where: { customerId: dto.mergedAwayId }, data: { customerId: dto.survivingId } });
      // 3. Move tag assignments, de-duplicating against the surviving record's tags.
      const survivingTags = new Set((await tx.customerTagAssignment.findMany({ where: { customerId: dto.survivingId }, select: { tagId: true } })).map((t) => t.tagId));
      const fromTags = await tx.customerTagAssignment.findMany({ where: { customerId: dto.mergedAwayId } });
      for (const t of fromTags) {
        if (survivingTags.has(t.tagId)) await tx.customerTagAssignment.delete({ where: { id: t.id } });
        else await tx.customerTagAssignment.update({ where: { id: t.id }, data: { customerId: dto.survivingId } });
      }
      // 4. Health profile: surviving wins; move the merged-away one only if surviving has none.
      const survHp = await tx.customerHealthProfile.findUnique({ where: { customerId: dto.survivingId } });
      const awayHp = await tx.customerHealthProfile.findUnique({ where: { customerId: dto.mergedAwayId } });
      if (awayHp) {
        if (survHp) await tx.customerHealthProfile.delete({ where: { customerId: dto.mergedAwayId } });
        else await tx.customerHealthProfile.update({ where: { customerId: dto.mergedAwayId }, data: { customerId: dto.survivingId } });
      }
      // 5. Archive the duplicate, permanently marking where it went.
      await tx.customer.update({ where: { id: dto.mergedAwayId }, data: { isActive: false, isMergedInto: dto.survivingId } });
      return sales.count;
    });

    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'CUSTOMERS_MERGED', entityType: 'CUSTOMER', entityId: dto.survivingId, metadata: { survivingId: dto.survivingId, mergedAwayId: dto.mergedAwayId, reassignedSales } });
    this.events.merged({ pharmacyId: user.pharmacyId, survivingId: dto.survivingId, mergedAwayId: dto.mergedAwayId });
    return { survivingId: dto.survivingId, mergedAwayId: dto.mergedAwayId, reassignedSales };
  }
}
