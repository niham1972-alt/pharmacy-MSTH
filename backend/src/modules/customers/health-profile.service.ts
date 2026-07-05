import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CustomerEventsEmitter } from './events/customer-events.emitter';
import { UpdateHealthProfileDto } from './dto/customers.dto';

/**
 * Deliberately a SEPARATE service (not a method on CustomersService) so the
 * elevated-access boundary for health-adjacent data is architecturally explicit
 * and trivially auditable — a reviewer checking "who can read patient health
 * data" only needs to look here. Only reached via HealthProfileController, which
 * is gated to admin/pharmacist. Never cached (read fresh each time). Every access
 * is audit-logged (HEALTH_PROFILE_VIEWED), not just modifications.
 */
@Injectable()
export class HealthProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: CustomerEventsEmitter,
  ) {}

  private async ensureCustomer(user: AuthenticatedUser, customerId: string) {
    const c = await this.prisma.customer.findFirst({ where: { id: customerId, pharmacyId: user.pharmacyId }, select: { id: true } });
    if (!c) throw new NotFoundException({ errorCode: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
  }

  async get(user: AuthenticatedUser, customerId: string) {
    await this.ensureCustomer(user, customerId);
    const hp = await this.prisma.customerHealthProfile.findUnique({ where: { customerId } });
    // Log ACCESS, not just changes — sensitivity requires access visibility (spec §14).
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'HEALTH_PROFILE_VIEWED', entityType: 'CUSTOMER', entityId: customerId });
    if (!hp) return { customerId, allergiesFreeText: null, allergyTags: [], chronicConditionsFreeText: null, chronicConditionTags: [], exists: false };
    return {
      customerId, allergiesFreeText: hp.allergiesFreeText, allergyTags: hp.allergyTags, chronicConditionsFreeText: hp.chronicConditionsFreeText,
      chronicConditionTags: hp.chronicConditionTags, updatedBy: hp.updatedBy, updatedAt: hp.updatedAt.toISOString(), exists: true,
    };
  }

  async update(user: AuthenticatedUser, customerId: string, dto: UpdateHealthProfileDto) {
    await this.ensureCustomer(user, customerId);
    const before = await this.prisma.customerHealthProfile.findUnique({ where: { customerId } });
    await this.prisma.customerHealthProfile.upsert({
      where: { customerId },
      update: { allergiesFreeText: dto.allergiesFreeText, allergyTags: dto.allergyTags ?? undefined, chronicConditionsFreeText: dto.chronicConditionsFreeText, chronicConditionTags: dto.chronicConditionTags ?? undefined, updatedBy: user.userId },
      create: { customerId, allergiesFreeText: dto.allergiesFreeText, allergyTags: dto.allergyTags ?? [], chronicConditionsFreeText: dto.chronicConditionsFreeText, chronicConditionTags: dto.chronicConditionTags ?? [], updatedBy: user.userId },
    });
    // Heightened-visibility audit with before/after of the sensitive fields.
    await this.audit.record({
      pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'HEALTH_PROFILE_UPDATED', entityType: 'CUSTOMER', entityId: customerId,
      metadata: { before: before ? { allergyTags: before.allergyTags, chronicConditionTags: before.chronicConditionTags } : null, after: { allergyTags: dto.allergyTags, chronicConditionTags: dto.chronicConditionTags } },
    });
    this.events.healthProfileUpdated({ pharmacyId: user.pharmacyId, customerId });
    return this.get(user, customerId);
  }
}
