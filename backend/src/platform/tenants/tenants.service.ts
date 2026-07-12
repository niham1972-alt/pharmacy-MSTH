import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantStatusService } from '../../common/auth/tenant-status.service';
import { UsersService } from '../../modules/users/users.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PlatformStaff } from '../common/platform-staff.interface';
import { PlatformAuditService } from '../common/platform-audit.service';
import { OnboardTenantDto, TenantListQuery, UpdateTenantDto } from '../dto/platform.dto';

const dec = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : typeof v === 'number' ? v : v.toNumber());

@Injectable()
export class TenantsService {
  private readonly logger = new Logger('TenantsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PlatformAuditService,
    private readonly tenantStatus: TenantStatusService,
    private readonly users: UsersService,
  ) {}

  async list(q: TenantListQuery) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const where: Prisma.PharmacyWhereInput = {
      ...(q.search ? { OR: [{ businessName: { contains: q.search, mode: 'insensitive' } }, { contactEmail: { contains: q.search, mode: 'insensitive' } }] } : {}),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.billingStatus ? { billingStatus: q.billingStatus } : {}),
      ...(q.planId ? { subscriptionPlanId: q.planId } : {}),
    };
    const orderBy: Prisma.PharmacyOrderByWithRelationInput = { [q.sortBy || 'createdAt']: q.sortOrder === 'asc' ? 'asc' : 'desc' } as never;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.pharmacy.count({ where }),
      this.prisma.pharmacy.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit, include: { subscriptionPlan: { select: { name: true } } } }),
    ]);
    // Batch user counts for the page (avoids N+1).
    const ids = rows.map((r) => r.id);
    const userCounts = ids.length
      ? await this.prisma.user.groupBy({ by: ['pharmacyId'], where: { pharmacyId: { in: ids }, status: { not: 'DEACTIVATED' } }, _count: { _all: true }, orderBy: { pharmacyId: 'asc' } })
      : [];
    const countOf = new Map(userCounts.map((u) => [u.pharmacyId, u._count._all]));
    return {
      page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)),
      data: rows.map((r) => ({
        id: r.id, businessName: r.businessName, contactEmail: r.contactEmail, status: r.status,
        billingStatus: r.billingStatus, planName: r.subscriptionPlan?.name ?? null, userCount: countOf.get(r.id) ?? 0,
        trialEndsAt: r.trialEndsAt?.toISOString() ?? null, nextRenewalDate: r.nextRenewalDate?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async detail(id: string) {
    const t = await this.prisma.pharmacy.findUnique({ where: { id }, include: { subscriptionPlan: true } });
    if (!t) throw new NotFoundException({ errorCode: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    const [userCount, activeAdmins, impersonations] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { pharmacyId: id, status: { not: 'DEACTIVATED' } } }),
      this.prisma.userRoleAssignment.count({ where: { role: 'ADMIN', user: { pharmacyId: id, status: 'ACTIVE' } } }),
      this.prisma.impersonationSession.count({ where: { targetPharmacyId: id } }),
    ]);
    return {
      ...this.serialize(t),
      plan: t.subscriptionPlan ? { id: t.subscriptionPlan.id, name: t.subscriptionPlan.name, priceAmount: dec(t.subscriptionPlan.priceAmount), billingInterval: t.subscriptionPlan.billingInterval } : null,
      userCount,
      hasActiveAdmin: activeAdmins > 0,
      impersonationCount: impersonations,
    };
  }

  private serialize(t: Prisma.PharmacyGetPayload<{ include: { subscriptionPlan: true } }>) {
    return {
      id: t.id, businessName: t.businessName, contactEmail: t.contactEmail, contactPhone: t.contactPhone,
      status: t.status, subscriptionPlanId: t.subscriptionPlanId, billingStatus: t.billingStatus,
      trialStartedAt: t.trialStartedAt?.toISOString() ?? null, trialEndsAt: t.trialEndsAt?.toISOString() ?? null,
      nextRenewalDate: t.nextRenewalDate?.toISOString() ?? null, suspendedAt: t.suspendedAt?.toISOString() ?? null,
      suspendedReason: t.suspendedReason, archivedAt: t.archivedAt?.toISOString() ?? null, archivedReason: t.archivedReason,
      notes: t.notes, createdAt: t.createdAt.toISOString(),
    };
  }

  async onboard(staff: PlatformStaff, dto: OnboardTenantDto) {
    const dup = await this.prisma.pharmacy.findFirst({ where: { OR: [{ businessName: dto.businessName }, { contactEmail: dto.contactEmail }] } });
    if (dup) throw new ConflictException({ errorCode: 'TENANT_EXISTS', message: 'A tenant with this business name or contact email already exists.' });
    if (dto.subscriptionPlanId) {
      const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: dto.subscriptionPlanId } });
      if (!plan) throw new BadRequestException({ errorCode: 'INVALID_PLAN', message: 'Subscription plan not found.' });
      if (!plan.isActive) throw new BadRequestException({ errorCode: 'PLAN_RETIRED', message: 'Cannot assign a retired plan to a new tenant.' });
    }

    const now = new Date();
    const trialDays = dto.trialDays ?? 14;
    const initialBranchId = randomUUID(); // branchId is a loose string across Modules 1–18

    const tenant = await this.prisma.pharmacy.create({
      data: {
        businessName: dto.businessName, contactEmail: dto.contactEmail, contactPhone: dto.contactPhone,
        status: 'TRIAL', billingStatus: 'TRIAL', subscriptionPlanId: dto.subscriptionPlanId,
        trialStartedAt: now, trialEndsAt: new Date(now.getTime() + trialDays * 86400000), notes: dto.notes,
        createdBy: staff.id,
      },
      include: { subscriptionPlan: true },
    });

    // Invite the first admin via Module 16's mechanism, scoped to the new tenant.
    let adminInvite: { invited: boolean; email?: string; error?: string } = { invited: false };
    if (dto.adminEmail) {
      const systemActor: AuthenticatedUser = {
        userId: `platform:${staff.id}`, role: 'admin', pharmacyId: tenant.id,
        branchId: initialBranchId, accessibleBranchIds: [initialBranchId], email: staff.email,
      };
      try {
        await this.users.invite(systemActor, { email: dto.adminEmail, name: dto.adminName || dto.adminEmail, role: 'ADMIN', branchIds: [initialBranchId], defaultBranchId: initialBranchId } as never);
        adminInvite = { invited: true, email: dto.adminEmail };
      } catch (err) {
        this.logger.error(`Admin invite failed for tenant ${tenant.id}`, err as Error);
        adminInvite = { invited: false, email: dto.adminEmail, error: (err as Error).message };
      }
    }

    await this.audit.record(staff, 'TENANT_ONBOARDED', 'PHARMACY', { entityId: tenant.id, targetPharmacyId: tenant.id, metadata: { businessName: dto.businessName, planId: dto.subscriptionPlanId, adminInvited: adminInvite.invited } });
    return { ...this.serialize(tenant), initialBranchId, adminInvite };
  }

  async update(staff: PlatformStaff, id: string, dto: UpdateTenantDto) {
    await this.ensure(id);
    const updated = await this.prisma.pharmacy.update({ where: { id }, data: { businessName: dto.businessName, contactEmail: dto.contactEmail, contactPhone: dto.contactPhone, notes: dto.notes }, include: { subscriptionPlan: true } });
    await this.audit.record(staff, 'TENANT_UPDATED', 'PHARMACY', { entityId: id, targetPharmacyId: id, metadata: { fields: Object.keys(dto) } });
    return this.serialize(updated);
  }

  async suspend(staff: PlatformStaff, id: string, reason?: string) {
    const t = await this.ensure(id);
    if (t.status === 'ARCHIVED') throw new BadRequestException({ errorCode: 'TENANT_ARCHIVED', message: 'An archived tenant cannot be suspended.' });
    await this.prisma.$transaction([
      this.prisma.pharmacy.update({ where: { id }, data: { status: 'SUSPENDED', billingStatus: 'PAST_DUE', suspendedAt: new Date(), suspendedReason: reason } }),
      // Reflect in tenant user records (login is already blocked tenant-wide by TenantStatusService).
      this.prisma.user.updateMany({ where: { pharmacyId: id, status: 'ACTIVE' }, data: { status: 'SUSPENDED' } }),
    ]);
    this.tenantStatus.invalidate(id);
    await this.audit.record(staff, 'TENANT_SUSPENDED', 'PHARMACY', { entityId: id, targetPharmacyId: id, metadata: { reason } });
    return { id, status: 'SUSPENDED' };
  }

  async reactivate(staff: PlatformStaff, id: string) {
    const t = await this.ensure(id);
    if (t.status !== 'SUSPENDED') throw new BadRequestException({ errorCode: 'NOT_SUSPENDED', message: 'Only a suspended tenant can be reactivated.' });
    await this.prisma.$transaction([
      this.prisma.pharmacy.update({ where: { id }, data: { status: 'ACTIVE', billingStatus: 'ACTIVE', suspendedAt: null, suspendedReason: null } }),
      this.prisma.user.updateMany({ where: { pharmacyId: id, status: 'SUSPENDED' }, data: { status: 'ACTIVE' } }),
    ]);
    this.tenantStatus.invalidate(id);
    await this.audit.record(staff, 'TENANT_REACTIVATED', 'PHARMACY', { entityId: id, targetPharmacyId: id });
    return { id, status: 'ACTIVE' };
  }

  async archive(staff: PlatformStaff, id: string, reason?: string) {
    const t = await this.ensure(id);
    if (t.status === 'ARCHIVED') throw new BadRequestException({ errorCode: 'ALREADY_ARCHIVED', message: 'Tenant is already archived.' });
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.pharmacy.update({ where: { id }, data: { status: 'ARCHIVED', billingStatus: 'CANCELLED', archivedAt: now, archivedReason: reason } }),
      this.prisma.user.updateMany({ where: { pharmacyId: id, status: { in: ['ACTIVE', 'SUSPENDED'] } }, data: { status: 'SUSPENDED' } }),
      // Forcibly terminate any live impersonation targeting this tenant.
      this.prisma.impersonationSession.updateMany({ where: { targetPharmacyId: id, endedAt: null }, data: { endedAt: now, endedReason: 'TENANT_ARCHIVED' } }),
    ]);
    this.tenantStatus.invalidate(id);
    await this.audit.record(staff, 'TENANT_ARCHIVED', 'PHARMACY', { entityId: id, targetPharmacyId: id, metadata: { reason } });
    return { id, status: 'ARCHIVED' };
  }

  async usage(id: string) {
    await this.ensure(id);
    const [userCount, medicineCount, salesAgg, branchGroups, lastSale] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { pharmacyId: id, status: { not: 'DEACTIVATED' } } }),
      this.prisma.medicine.count({ where: { pharmacyId: id } }),
      this.prisma.sale.aggregate({ where: { pharmacyId: id, status: 'COMPLETED' }, _count: { _all: true }, _sum: { grandTotal: true } }),
      this.prisma.userBranchAccess.groupBy({ by: ['branchId'], where: { user: { pharmacyId: id } }, orderBy: { branchId: 'asc' } }),
      this.prisma.sale.findFirst({ where: { pharmacyId: id }, orderBy: { saleDate: 'desc' }, select: { saleDate: true } }),
    ]);
    return {
      userCount, branchCount: branchGroups.length, medicineCount,
      transactionCount: salesAgg._count._all, transactionVolume: dec(salesAgg._sum.grandTotal),
      lastActivityAt: lastSale?.saleDate?.toISOString() ?? null,
    };
  }

  private async ensure(id: string) {
    const t = await this.prisma.pharmacy.findUnique({ where: { id } });
    if (!t) throw new NotFoundException({ errorCode: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    return t;
  }
}
