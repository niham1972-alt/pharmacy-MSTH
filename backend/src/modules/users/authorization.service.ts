import { Injectable } from '@nestjs/common';
import { SystemRole, StepUpStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSION_MATRIX, ROLE_CLAIM } from './config/permission-matrix.config';

/**
 * THE central RBAC engine (Module 16). Other modules' per-request authorization
 * reads role claims from the verified JWT (fast, no DB hit) via the canonical
 * `common/guards/roles.guard.ts`. This service answers the richer, permission-key
 * questions — "can this user do X?" — resolving a role's baseline from the
 * central permission matrix PLUS any active (non-expired) per-user overrides.
 * super_admin passes everything.
 */
@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Roles a user currently holds (from this module's authoritative data). */
  async getUserRoles(params: { userId: string }): Promise<SystemRole[]> {
    const rows = await this.prisma.userRoleAssignment.findMany({ where: { userId: params.userId }, select: { role: true } });
    return rows.map((r) => r.role);
  }

  async getUserBranchAccess(params: { userId: string }): Promise<string[]> {
    const rows = await this.prisma.userBranchAccess.findMany({ where: { userId: params.userId }, select: { branchId: true } });
    return rows.map((r) => r.branchId);
  }

  /**
   * Role baseline (from the matrix) + active overrides. Overrides only ADD
   * capability, never subtract (spec §11). Expired overrides are ignored.
   */
  async hasPermission(params: { userId: string; permissionKey: string }): Promise<boolean> {
    const roles = await this.getUserRoles(params);
    if (roles.includes('SUPER_ADMIN')) return true;
    const def = PERMISSION_MATRIX.find((p) => p.key === params.permissionKey);
    if (def && def.allowedRoles.some((r) => roles.includes(r))) return true;
    // Fall through to a per-user override (addition only).
    const now = new Date();
    const override = await this.prisma.userPermissionOverride.findFirst({ where: { userId: params.userId, permissionKey: params.permissionKey } });
    return !!override && (!override.expiresAt || override.expiresAt.getTime() > now.getTime());
  }

  /** Does a given role satisfy a required role? super_admin/admin cover everything. */
  roleSatisfies(actual: SystemRole[], required: SystemRole): boolean {
    if (actual.includes('SUPER_ADMIN') || actual.includes('ADMIN')) return true;
    return actual.includes(required);
  }

  /** Compute the claims blob to push to Supabase Auth for a user. */
  async computeClaims(userId: string, pharmacyId: string): Promise<{ role: string; pharmacyId: string; branchId: string; accessibleBranchIds: string[]; status: string }> {
    const [roles, branches, user] = await Promise.all([
      this.prisma.userRoleAssignment.findMany({ where: { userId }, orderBy: { assignedAt: 'asc' } }),
      this.prisma.userBranchAccess.findMany({ where: { userId }, orderBy: { grantedAt: 'asc' } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } }),
    ]);
    // Primary role = highest-privilege held (super_admin > admin > … order in ROLE_CLAIM).
    const order = Object.keys(ROLE_CLAIM) as SystemRole[];
    const primary = order.find((r) => roles.some((x) => x.role === r)) ?? roles[0]?.role;
    const defaultBranch = branches.find((b) => b.isDefault) ?? branches[0];
    return {
      role: primary ? ROLE_CLAIM[primary] : 'cashier',
      pharmacyId,
      branchId: defaultBranch?.branchId ?? '',
      accessibleBranchIds: branches.map((b) => b.branchId),
      status: user?.status ?? 'ACTIVE',
    };
  }

  /** Expire any pending step-up requests past their window (lazy, on-read). */
  async expireStale(): Promise<void> {
    await this.prisma.stepUpVerification.updateMany({ where: { status: 'PENDING', expiresAt: { lt: new Date() } }, data: { status: StepUpStatus.EXPIRED } });
  }
}
