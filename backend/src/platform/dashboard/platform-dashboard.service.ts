import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const dec = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : typeof v === 'number' ? v : v.toNumber());

/**
 * Cross-tenant platform analytics. These are the ONLY queries in the system that
 * deliberately span multiple pharmacyId values. Results are cached briefly so
 * this heavy aggregation never runs inline with a tenant's own request path.
 */
@Injectable()
export class PlatformDashboardService {
  private cache: { data: unknown; ts: number } | null = null;
  private readonly TTL = 5 * 60_000;

  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    if (this.cache && Date.now() - this.cache.ts < this.TTL) return this.cache.data;

    const since30 = new Date(Date.now() - 30 * 86400000);
    const soon = new Date(Date.now() + 7 * 86400000);
    const [byStatus, byBilling, newSignups, plans, salesAgg, needAttention, expiringTrials] = await this.prisma.$transaction([
      this.prisma.pharmacy.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
      this.prisma.pharmacy.groupBy({ by: ['billingStatus'], _count: { _all: true }, orderBy: { billingStatus: 'asc' } }),
      this.prisma.pharmacy.count({ where: { createdAt: { gte: since30 } } }),
      this.prisma.subscriptionPlan.findMany({ where: { isActive: true }, select: { id: true, name: true, priceAmount: true, billingInterval: true } }),
      this.prisma.sale.aggregate({ where: { status: 'COMPLETED' }, _count: { _all: true }, _sum: { grandTotal: true } }),
      this.prisma.pharmacy.findMany({ where: { OR: [{ billingStatus: 'PAST_DUE' }, { status: 'PAST_DUE' }, { status: 'SUSPENDED' }] }, take: 20, orderBy: { updatedAt: 'desc' }, select: { id: true, businessName: true, status: true, billingStatus: true } }),
      this.prisma.pharmacy.findMany({ where: { status: 'TRIAL', trialEndsAt: { lte: soon, gte: new Date() } }, take: 20, orderBy: { trialEndsAt: 'asc' }, select: { id: true, businessName: true, trialEndsAt: true } }),
    ]);

    // groupBy typing degrades inside $transaction — cast to the known shape.
    const byStatusT = byStatus as Array<{ status: string; _count: { _all: number } }>;
    const byBillingT = byBilling as Array<{ billingStatus: string; _count: { _all: number } }>;
    const statusCount = (s: string) => byStatusT.find((r) => r.status === s)?._count._all ?? 0;
    const total = byStatusT.reduce((sum, r) => sum + r._count._all, 0);

    // MRR estimate: active tenants' plan price (monthly-normalized).
    const planPrice = new Map(plans.map((p) => [p.id, { monthly: p.billingInterval === 'ANNUAL' ? dec(p.priceAmount) / 12 : dec(p.priceAmount) }]));
    const activeTenants = await this.prisma.pharmacy.findMany({ where: { status: { in: ['ACTIVE', 'PAST_DUE'] }, subscriptionPlanId: { not: null } }, select: { subscriptionPlanId: true } });
    const mrr = activeTenants.reduce((sum, t) => sum + (t.subscriptionPlanId ? planPrice.get(t.subscriptionPlanId)?.monthly ?? 0 : 0), 0);

    const trials = statusCount('TRIAL');
    const active = statusCount('ACTIVE');
    const data = {
      totalTenants: total,
      activeTenants: active,
      trialTenants: trials,
      pastDueTenants: statusCount('PAST_DUE'),
      suspendedTenants: statusCount('SUSPENDED'),
      archivedTenants: statusCount('ARCHIVED'),
      newSignups30d: newSignups,
      trialToPaidRate: trials + active > 0 ? Math.round((active / (active + trials)) * 1000) / 10 : 0,
      byBillingStatus: Object.fromEntries(byBillingT.map((r) => [r.billingStatus, r._count._all])),
      mrr: Math.round(mrr * 100) / 100,
      platformTransactionCount: salesAgg._count._all,
      platformTransactionVolume: dec(salesAgg._sum.grandTotal),
      tenantsNeedingAttention: needAttention.map((t) => ({ id: t.id, businessName: t.businessName, status: t.status, billingStatus: t.billingStatus })),
      expiringTrials: expiringTrials.map((t) => ({ id: t.id, businessName: t.businessName, trialEndsAt: t.trialEndsAt?.toISOString() ?? null })),
      generatedAt: new Date().toISOString(),
    };
    this.cache = { data, ts: Date.now() };
    return data;
  }

  invalidate() {
    this.cache = null;
  }
}
