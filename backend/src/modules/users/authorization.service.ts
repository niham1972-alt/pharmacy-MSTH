import { Injectable } from '@nestjs/common';
import { SystemRole, StepUpStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLE_CLAIM, permissionsForRoles } from './config/permission-matrix.config';

export interface EffectivePermissions {
  roles: SystemRole[];
  fromRole: string[]; // keys the role(s) grant by default
  granted: string[]; // keys added by an explicit GRANT override
  revoked: string[]; // keys removed by an explicit REVOKE override
  effective: string[]; // final resolved set = fromRole ∪ granted − revoked
  isSuperAdmin: boolean;
}

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

  // Effective-permission cache. Keyed by DB user id; invalidated whenever a
  // user's roles or overrides change (spec §Implementation Notes — "cache the
  // resolved set per user, invalidate on change"). authUserId→userId is stable
  // so it's cached without expiry to keep the per-request guard DB-free on a hit.
  private readonly permCache = new Map<string, { value: EffectivePermissions; ts: number }>();
  private readonly authToUserId = new Map<string, string>();
  private readonly CACHE_TTL = 5 * 60_000;

  invalidate(userId: string): void {
    this.permCache.delete(userId);
  }

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
   * THE effective-permission resolver (spec §3): role defaults ∪ per-user grants
   * − per-user revokes. Cached per user. super_admin always resolves to the full
   * set and is immune to revokes (never lock out the top account).
   */
  async getEffectivePermissions(userId: string): Promise<EffectivePermissions> {
    const hit = this.permCache.get(userId);
    if (hit && Date.now() - hit.ts < this.CACHE_TTL) return hit.value;

    const [roleRows, overrides] = await Promise.all([
      this.prisma.userRoleAssignment.findMany({ where: { userId }, select: { role: true } }),
      this.prisma.userPermissionOverride.findMany({ where: { userId } }),
    ]);
    const roles = roleRows.map((r) => r.role);
    const isSuperAdmin = roles.includes('SUPER_ADMIN');
    const fromRole = permissionsForRoles(roles);

    const now = Date.now();
    const active = overrides.filter((o) => !o.expiresAt || o.expiresAt.getTime() > now);
    const granted = active.filter((o) => o.effect === 'GRANT').map((o) => o.permissionKey);
    const revoked = active.filter((o) => o.effect === 'REVOKE').map((o) => o.permissionKey);

    const effectiveSet = new Set(fromRole);
    for (const k of granted) effectiveSet.add(k);
    if (!isSuperAdmin) for (const k of revoked) effectiveSet.delete(k); // super_admin keeps everything

    const value: EffectivePermissions = { roles, fromRole: [...fromRole], granted, revoked, effective: [...effectiveSet], isSuperAdmin };
    this.permCache.set(userId, { value, ts: Date.now() });
    return value;
  }

  async hasPermission(params: { userId: string; permissionKey: string }): Promise<boolean> {
    const eff = await this.getEffectivePermissions(params.userId);
    return eff.isSuperAdmin || eff.effective.includes(params.permissionKey);
  }

  /**
   * Per-request entry point for the PermissionsGuard: resolves by the JWT's
   * Supabase auth id. Returns null when the caller isn't a known DB user (e.g. a
   * seed/system token) so the guard can fall back to a role-based check.
   */
  async getEffectivePermissionsByAuth(authUserId: string): Promise<EffectivePermissions | null> {
    let userId = this.authToUserId.get(authUserId);
    if (!userId) {
      const u = await this.prisma.user.findFirst({ where: { authUserId }, select: { id: true } });
      if (!u) return null;
      userId = u.id;
      this.authToUserId.set(authUserId, userId);
    }
    return this.getEffectivePermissions(userId);
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
