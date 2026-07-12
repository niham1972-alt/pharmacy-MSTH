import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface LimitCheckResult {
  allowed: boolean;
  limit: number | null; // null = unlimited / no plan
  current: number;
  planName?: string;
  message?: string;
}

/**
 * Cross-cutting plan-limit checks. Exported (@Global platform module) so
 * tenant-facing flows — e.g. Module 16's user-invite and branch-creation — can
 * ask "is this tenant allowed to add another user?" and surface a clear
 * upgrade-nudge instead of silently failing. A tenant with no plan (or an
 * unlimited plan) is always allowed (soft gate).
 */
@Injectable()
export class PlanLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  private async plan(pharmacyId: string) {
    const tenant = await this.prisma.pharmacy.findUnique({ where: { id: pharmacyId }, include: { subscriptionPlan: true } });
    return tenant?.subscriptionPlan ?? null;
  }

  async checkCanAddUser(pharmacyId: string): Promise<LimitCheckResult> {
    const plan = await this.plan(pharmacyId);
    if (!plan || plan.maxUsers == null) return { allowed: true, limit: plan?.maxUsers ?? null, current: 0, planName: plan?.name };
    const current = await this.prisma.user.count({ where: { pharmacyId, status: { not: 'DEACTIVATED' } } });
    const allowed = current < plan.maxUsers;
    return {
      allowed,
      limit: plan.maxUsers,
      current,
      planName: plan.name,
      message: allowed ? undefined : `You've reached your ${plan.name} plan's user limit (${plan.maxUsers}). Upgrade to add more.`,
    };
  }

  async checkCanAddBranch(pharmacyId: string, currentBranchCount: number): Promise<LimitCheckResult> {
    const plan = await this.plan(pharmacyId);
    if (!plan || plan.maxBranches == null) return { allowed: true, limit: plan?.maxBranches ?? null, current: currentBranchCount, planName: plan?.name };
    const allowed = currentBranchCount < plan.maxBranches;
    return {
      allowed,
      limit: plan.maxBranches,
      current: currentBranchCount,
      planName: plan.name,
      message: allowed ? undefined : `You've reached your ${plan.name} plan's branch limit (${plan.maxBranches}). Upgrade to add more.`,
    };
  }
}
