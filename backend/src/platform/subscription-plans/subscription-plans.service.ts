import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformStaff } from '../common/platform-staff.interface';
import { PlatformAuditService } from '../common/platform-audit.service';
import { SubscriptionPlanDto } from '../dto/platform.dto';

const dec = (v: Prisma.Decimal | number): number => (typeof v === 'number' ? v : v.toNumber());

@Injectable()
export class SubscriptionPlansService {
  constructor(private readonly prisma: PrismaService, private readonly audit: PlatformAuditService) {}

  private serialize(p: Prisma.SubscriptionPlanGetPayload<object>) {
    return {
      id: p.id, name: p.name, priceAmount: dec(p.priceAmount), billingInterval: p.billingInterval,
      maxUsers: p.maxUsers, maxBranches: p.maxBranches, maxMonthlyTransactions: p.maxMonthlyTransactions,
      includedFeatures: p.includedFeatures, isActive: p.isActive,
    };
  }

  async list() {
    const rows = await this.prisma.subscriptionPlan.findMany({ orderBy: { priceAmount: 'asc' } });
    return rows.map((p) => this.serialize(p));
  }

  async create(staff: PlatformStaff, dto: SubscriptionPlanDto) {
    try {
      const created = await this.prisma.subscriptionPlan.create({
        data: {
          name: dto.name, priceAmount: dto.priceAmount, billingInterval: dto.billingInterval,
          maxUsers: dto.maxUsers, maxBranches: dto.maxBranches, maxMonthlyTransactions: dto.maxMonthlyTransactions,
          includedFeatures: (dto.includedFeatures ?? undefined) as Prisma.InputJsonValue, isActive: dto.isActive ?? true,
        },
      });
      await this.audit.record(staff, 'SUBSCRIPTION_PLAN_CREATED', 'SUBSCRIPTION_PLAN', { entityId: created.id, metadata: { name: dto.name } });
      return this.serialize(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ errorCode: 'PLAN_EXISTS', message: `A plan named "${dto.name}" already exists.` });
      }
      throw err;
    }
  }

  async update(staff: PlatformStaff, id: string, dto: SubscriptionPlanDto) {
    await this.ensure(id);
    const updated = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: dto.name, priceAmount: dto.priceAmount, billingInterval: dto.billingInterval,
        maxUsers: dto.maxUsers, maxBranches: dto.maxBranches, maxMonthlyTransactions: dto.maxMonthlyTransactions,
        includedFeatures: (dto.includedFeatures ?? undefined) as Prisma.InputJsonValue, isActive: dto.isActive,
      },
    });
    await this.audit.record(staff, 'SUBSCRIPTION_PLAN_UPDATED', 'SUBSCRIPTION_PLAN', { entityId: id, metadata: { name: updated.name, isActive: updated.isActive } });
    return this.serialize(updated);
  }

  /** Plans are RETIRED (isActive=false), never deleted, so existing tenant
   *  assignments don't orphan. */
  async retire(staff: PlatformStaff, id: string) {
    await this.ensure(id);
    const updated = await this.prisma.subscriptionPlan.update({ where: { id }, data: { isActive: false } });
    await this.audit.record(staff, 'SUBSCRIPTION_PLAN_UPDATED', 'SUBSCRIPTION_PLAN', { entityId: id, metadata: { retired: true } });
    return this.serialize(updated);
  }

  async changePlan(staff: PlatformStaff, tenantId: string, planId: string) {
    const [tenant, plan] = await Promise.all([
      this.prisma.pharmacy.findUnique({ where: { id: tenantId } }),
      this.prisma.subscriptionPlan.findUnique({ where: { id: planId } }),
    ]);
    if (!tenant) throw new NotFoundException({ errorCode: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    if (!plan) throw new NotFoundException({ errorCode: 'PLAN_NOT_FOUND', message: 'Plan not found' });
    if (!plan.isActive) throw new BadRequestException({ errorCode: 'PLAN_RETIRED', message: 'Cannot assign a retired plan.' });
    await this.prisma.pharmacy.update({ where: { id: tenantId }, data: { subscriptionPlanId: planId, billingStatus: tenant.billingStatus === 'TRIAL' ? 'ACTIVE' : tenant.billingStatus } });
    await this.audit.record(staff, 'TENANT_PLAN_CHANGED', 'PHARMACY', { entityId: tenantId, targetPharmacyId: tenantId, metadata: { fromPlanId: tenant.subscriptionPlanId, toPlanId: planId, planName: plan.name } });
    return { tenantId, planId, planName: plan.name };
  }

  private async ensure(id: string) {
    const p = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!p) throw new NotFoundException({ errorCode: 'PLAN_NOT_FOUND', message: 'Plan not found' });
    return p;
  }
}
