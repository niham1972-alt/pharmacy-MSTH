import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { SupabaseAdminService } from './supabase-admin.service';
import { AuthorizationService } from './authorization.service';
import { UserEventsEmitter } from './events/user-events.emitter';
import { PERMISSION_MATRIX, ROLE_CLAIM, ALL_ROLES, isKnownPermissionKey } from './config/permission-matrix.config';
import { AssignRoleDto, GrantBranchAccessDto, GrantOverrideDto, InviteUserDto, UpdateUserDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseAdminService,
    private readonly authz: AuthorizationService,
    private readonly events: UserEventsEmitter,
    private readonly audit: AuditLogService,
  ) {}

  private async ensure(user: AuthenticatedUser, id: string) {
    const u = await this.prisma.user.findFirst({ where: { id, pharmacyId: user.pharmacyId } });
    if (!u) throw new NotFoundException({ errorCode: 'USER_NOT_FOUND', message: 'User not found' });
    return u;
  }

  /** Push this module's current view of a user's role/branch/status to the JWT claims. */
  private async syncClaims(userId: string, pharmacyId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) return;
    const claims = await this.authz.computeClaims(userId, pharmacyId);
    await this.supabase.updateAppMetadata(u.authUserId, claims);
  }

  // =========================================================================
  // List / detail / me
  // =========================================================================
  async list(user: AuthenticatedUser, q: { page?: string; limit?: string; search?: string; role?: string; status?: string; branchId?: string }) {
    const page = q.page ? Number(q.page) : 1;
    const limit = q.limit ? Number(q.limit) : 25;
    const where: import('@prisma/client').Prisma.UserWhereInput = { pharmacyId: user.pharmacyId };
    if (q.search?.trim()) where.OR = [{ name: { contains: q.search.trim(), mode: 'insensitive' } }, { email: { contains: q.search.trim(), mode: 'insensitive' } }];
    if (q.status) where.status = q.status as import('@prisma/client').UserStatus;
    if (q.role) where.roles = { some: { role: q.role as SystemRole } };
    if (q.branchId) where.branchAccess = { some: { branchId: q.branchId } };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({ where, orderBy: { name: 'asc' }, skip: (page - 1) * limit, take: limit, include: { roles: true, branchAccess: true, loginActivity: { orderBy: { loginAt: 'desc' }, take: 1 } } }),
    ]);
    return {
      page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)),
      data: rows.map((u) => ({ id: u.id, name: u.name, email: u.email, status: u.status, roles: u.roles.map((r) => r.role), branchCount: u.branchAccess.length, lastLoginAt: u.loginActivity[0]?.loginAt.toISOString() ?? null })),
    };
  }

  async detail(user: AuthenticatedUser, id: string) {
    const u = await this.prisma.user.findFirst({ where: { id, pharmacyId: user.pharmacyId }, include: { roles: true, branchAccess: true, permissionOverrides: true } });
    if (!u) throw new NotFoundException({ errorCode: 'USER_NOT_FOUND', message: 'User not found' });
    return {
      id: u.id, name: u.name, email: u.email, phone: u.phone, employeeId: u.employeeId, profilePhotoUrl: u.profilePhotoUrl, status: u.status,
      authUserId: u.authUserId, createdAt: u.createdAt.toISOString(), deactivatedAt: u.deactivatedAt?.toISOString() ?? null,
      roles: u.roles.map((r) => ({ role: r.role, assignedAt: r.assignedAt.toISOString() })),
      branchAccess: u.branchAccess.map((b) => ({ branchId: b.branchId, isDefault: b.isDefault })),
      permissionOverrides: u.permissionOverrides.map((o) => ({ permissionKey: o.permissionKey, reason: o.reason, expiresAt: o.expiresAt?.toISOString() ?? null })),
    };
  }

  async me(user: AuthenticatedUser) {
    const u = await this.prisma.user.findFirst({ where: { authUserId: user.userId }, include: { roles: true, branchAccess: true, permissionOverrides: true } });
    if (!u) {
      // No app-level record yet (e.g. a user provisioned directly in Supabase) —
      // fall back to the JWT claims so the app still works.
      return { id: null, name: user.email ?? 'User', email: user.email, status: 'ACTIVE', roles: [user.role], branchAccess: user.accessibleBranchIds.map((b) => ({ branchId: b, isDefault: b === user.branchId })), permissionKeys: this.permissionKeysForClaimRole(user.role) };
    }
    return {
      id: u.id, name: u.name, email: u.email, phone: u.phone, status: u.status,
      roles: u.roles.map((r) => ROLE_CLAIM[r.role]),
      branchAccess: u.branchAccess.map((b) => ({ branchId: b.branchId, isDefault: b.isDefault })),
      permissionKeys: await this.resolvePermissionKeys(u.id, u.roles.map((r) => r.role)),
    };
  }

  private permissionKeysForClaimRole(claimRole: string): string[] {
    const enumRole = (Object.entries(ROLE_CLAIM).find(([, c]) => c === claimRole)?.[0]) as SystemRole | undefined;
    if (!enumRole) return [];
    if (enumRole === 'SUPER_ADMIN') return PERMISSION_MATRIX.map((p) => p.key);
    return PERMISSION_MATRIX.filter((p) => p.allowedRoles.includes(enumRole)).map((p) => p.key);
  }

  private async resolvePermissionKeys(userId: string, roles: SystemRole[]): Promise<string[]> {
    const keys = new Set<string>();
    if (roles.includes('SUPER_ADMIN')) { PERMISSION_MATRIX.forEach((p) => keys.add(p.key)); return [...keys]; }
    for (const p of PERMISSION_MATRIX) if (p.allowedRoles.some((r) => roles.includes(r))) keys.add(p.key);
    const now = new Date();
    const overrides = await this.prisma.userPermissionOverride.findMany({ where: { userId } });
    for (const o of overrides) if (!o.expiresAt || o.expiresAt.getTime() > now.getTime()) keys.add(o.permissionKey);
    return [...keys];
  }

  // =========================================================================
  // Invite / lifecycle
  // =========================================================================
  async invite(user: AuthenticatedUser, dto: InviteUserDto) {
    const dupEmail = await this.prisma.user.findFirst({ where: { pharmacyId: user.pharmacyId, email: dto.email } });
    if (dupEmail) {
      if (dupEmail.status === 'DEACTIVATED') throw new ConflictException({ errorCode: 'USER_DEACTIVATED_EXISTS', message: 'A deactivated user with this email exists. Reactivate that record instead of inviting a new one.', data: { id: dupEmail.id } });
      throw new ConflictException({ errorCode: 'USER_EXISTS', message: 'A user with this email already exists in this pharmacy.', data: { id: dupEmail.id } });
    }
    const role = dto.role as SystemRole;
    const branchIds = dto.branchIds && dto.branchIds.length ? dto.branchIds : role === 'SUPER_ADMIN' ? [] : [user.branchId];
    if (role !== 'SUPER_ADMIN' && branchIds.length === 0) throw new BadRequestException({ errorCode: 'BRANCH_REQUIRED', message: 'At least one branch is required for this role.' });

    const claims = { role: ROLE_CLAIM[role], pharmacyId: user.pharmacyId, branchId: dto.defaultBranchId ?? branchIds[0] ?? '', accessibleBranchIds: branchIds, status: 'PENDING_ACTIVATION' };
    const { authUserId, alreadyExisted } = await this.supabase.createUser({ email: dto.email, appMetadata: claims });

    const created = await this.prisma.user.create({
      data: {
        pharmacyId: user.pharmacyId, authUserId, name: dto.name, email: dto.email, phone: dto.phone, employeeId: dto.employeeId,
        status: 'PENDING_ACTIVATION', createdBy: user.userId,
        roles: { create: [{ role, assignedBy: user.userId }] },
        branchAccess: { create: branchIds.map((b, i) => ({ branchId: b, isDefault: dto.defaultBranchId ? b === dto.defaultBranchId : i === 0, grantedBy: user.userId })) },
      },
    });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'USER_INVITED', entityType: 'USER', entityId: created.id, metadata: { email: dto.email, role, alreadyExisted } });
    this.events.invited({ pharmacyId: user.pharmacyId, userId: created.id });
    return { id: created.id, authUserId, alreadyExisted, note: alreadyExisted ? 'Linked to an existing Supabase auth identity.' : 'Auth user created. Send them a password-set link (Supabase invite) to activate.' };
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateUserDto) {
    await this.ensure(user, id);
    await this.prisma.user.update({ where: { id }, data: { name: dto.name, phone: dto.phone, employeeId: dto.employeeId, profilePhotoUrl: dto.profilePhotoUrl } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'USER_UPDATED', entityType: 'USER', entityId: id });
    return this.detail(user, id);
  }

  async assignRole(user: AuthenticatedUser, id: string, dto: AssignRoleDto) {
    await this.ensure(user, id);
    await this.prisma.userRoleAssignment.upsert({ where: { userId_role: { userId: id, role: dto.role as SystemRole } }, update: {}, create: { userId: id, role: dto.role as SystemRole, assignedBy: user.userId } });
    await this.syncClaims(id, user.pharmacyId);
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'ROLE_ASSIGNED', entityType: 'USER', entityId: id, metadata: { role: dto.role } });
    return this.detail(user, id);
  }

  async removeRole(user: AuthenticatedUser, id: string, role: string) {
    await this.ensure(user, id);
    const count = await this.prisma.userRoleAssignment.count({ where: { userId: id } });
    if (count <= 1) throw new BadRequestException({ errorCode: 'LAST_ROLE', message: 'A user must have at least one role. Assign a replacement role before removing this one.' });
    await this.prisma.userRoleAssignment.deleteMany({ where: { userId: id, role: role as SystemRole } });
    await this.syncClaims(id, user.pharmacyId);
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'ROLE_REMOVED', entityType: 'USER', entityId: id, metadata: { role } });
    return this.detail(user, id);
  }

  async grantBranch(user: AuthenticatedUser, id: string, dto: GrantBranchAccessDto) {
    await this.ensure(user, id);
    if (dto.isDefault) await this.prisma.userBranchAccess.updateMany({ where: { userId: id }, data: { isDefault: false } });
    await this.prisma.userBranchAccess.upsert({ where: { userId_branchId: { userId: id, branchId: dto.branchId } }, update: { isDefault: dto.isDefault ?? undefined }, create: { userId: id, branchId: dto.branchId, isDefault: dto.isDefault ?? false, grantedBy: user.userId } });
    await this.syncClaims(id, user.pharmacyId);
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'BRANCH_ACCESS_GRANTED', entityType: 'USER', entityId: id, metadata: { branchId: dto.branchId } });
    return this.detail(user, id);
  }

  async revokeBranch(user: AuthenticatedUser, id: string, branchId: string) {
    const u = await this.ensure(user, id);
    const roles = await this.authz.getUserRoles({ userId: id });
    const count = await this.prisma.userBranchAccess.count({ where: { userId: id } });
    if (!roles.includes('SUPER_ADMIN') && count <= 1) throw new BadRequestException({ errorCode: 'LAST_BRANCH', message: 'A non-super-admin user must keep at least one branch.' });
    await this.prisma.userBranchAccess.deleteMany({ where: { userId: id, branchId } });
    await this.syncClaims(id, user.pharmacyId);
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'BRANCH_ACCESS_REVOKED', entityType: 'USER', entityId: id, metadata: { branchId } });
    void u;
    return this.detail(user, id);
  }

  private async setStatus(user: AuthenticatedUser, id: string, status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED', action: string, revoke: boolean) {
    const u = await this.ensure(user, id);
    // Guard: never leave the pharmacy with zero active super_admin/admin.
    if (status !== 'ACTIVE') {
      const roles = await this.authz.getUserRoles({ userId: id });
      if (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN')) {
        const otherAdmins = await this.prisma.user.count({ where: { pharmacyId: user.pharmacyId, status: 'ACTIVE', id: { not: id }, roles: { some: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } } } } });
        if (otherAdmins === 0) throw new BadRequestException({ errorCode: 'LAST_ADMIN', message: 'Cannot suspend/deactivate the last active admin. Assign another admin first.' });
      }
    }
    await this.prisma.user.update({ where: { id }, data: { status, ...(status === 'DEACTIVATED' ? { deactivatedAt: new Date(), deactivatedBy: user.userId } : {}) } });
    // Sync status into claims so the guard blocks the JWT on next request, and
    // revoke the refresh token immediately for suspend/deactivate.
    await this.syncClaims(id, user.pharmacyId);
    if (revoke) await this.supabase.revokeSessions(u.authUserId);
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action, entityType: 'USER', entityId: id, metadata: { status } });
    return { id, status };
  }

  suspend(user: AuthenticatedUser, id: string) { return this.setStatus(user, id, 'SUSPENDED', 'USER_SUSPENDED', true); }
  reactivate(user: AuthenticatedUser, id: string) { return this.setStatus(user, id, 'ACTIVE', 'USER_REACTIVATED', false); }
  deactivate(user: AuthenticatedUser, id: string) { return this.setStatus(user, id, 'DEACTIVATED', 'USER_DEACTIVATED', true); }

  async revokeSessions(user: AuthenticatedUser, id: string) {
    const u = await this.ensure(user, id);
    await this.supabase.revokeSessions(u.authUserId);
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'SESSIONS_REVOKED', entityType: 'USER', entityId: id });
    return { id, revoked: true };
  }

  async loginActivity(user: AuthenticatedUser, id: string) {
    const u = await this.prisma.user.findFirst({ where: { id, pharmacyId: user.pharmacyId } });
    if (!u) throw new NotFoundException({ errorCode: 'USER_NOT_FOUND', message: 'User not found' });
    const rows = await this.prisma.loginActivity.findMany({ where: { userId: id }, orderBy: { loginAt: 'desc' }, take: 50 });
    return rows.map((l) => ({ id: l.id, loginAt: l.loginAt.toISOString(), ipAddress: l.ipAddress, userAgent: l.userAgent, success: l.success, failureReason: l.failureReason }));
  }

  /** Called by the frontend right after a successful Supabase login. */
  async recordLogin(user: AuthenticatedUser, meta: { ipAddress?: string; userAgent?: string }) {
    const u = await this.prisma.user.findFirst({ where: { authUserId: user.userId } });
    if (!u) return { recorded: false };
    await this.prisma.loginActivity.create({ data: { userId: u.id, success: true, ipAddress: meta.ipAddress, userAgent: meta.userAgent } });
    if (u.status === 'PENDING_ACTIVATION') {
      await this.prisma.user.update({ where: { id: u.id }, data: { status: 'ACTIVE' } });
      await this.syncClaims(u.id, user.pharmacyId);
      this.events.activated({ pharmacyId: user.pharmacyId, userId: u.id });
    }
    return { recorded: true };
  }

  // =========================================================================
  // Permission overrides / matrix
  // =========================================================================
  async grantOverride(user: AuthenticatedUser, id: string, dto: GrantOverrideDto) {
    await this.ensure(user, id);
    if (!isKnownPermissionKey(dto.permissionKey)) throw new BadRequestException({ errorCode: 'UNKNOWN_PERMISSION_KEY', message: `Unknown permission key "${dto.permissionKey}".` });
    await this.prisma.userPermissionOverride.upsert({
      where: { userId_permissionKey: { userId: id, permissionKey: dto.permissionKey } },
      update: { reason: dto.reason, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null },
      create: { userId: id, permissionKey: dto.permissionKey, grantedBy: user.userId, reason: dto.reason, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null },
    });
    await this.syncClaims(id, user.pharmacyId);
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'PERMISSION_OVERRIDE_GRANTED', entityType: 'USER', entityId: id, metadata: { permissionKey: dto.permissionKey } });
    return this.detail(user, id);
  }

  async removeOverride(user: AuthenticatedUser, id: string, key: string) {
    await this.ensure(user, id);
    await this.prisma.userPermissionOverride.deleteMany({ where: { userId: id, permissionKey: key } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'PERMISSION_OVERRIDE_REMOVED', entityType: 'USER', entityId: id, metadata: { permissionKey: key } });
    return this.detail(user, id);
  }

  /** The consolidated role→permission grid (super_admin view). Static config. */
  permissionMatrix() {
    return {
      roles: ALL_ROLES.map((r) => ({ role: r, claim: ROLE_CLAIM[r] })),
      permissions: PERMISSION_MATRIX.map((p) => ({
        key: p.key, module: p.module, description: p.description,
        // super_admin implicitly allowed everywhere.
        allowed: Object.fromEntries(ALL_ROLES.map((r) => [r, r === 'SUPER_ADMIN' || p.allowedRoles.includes(r)])),
      })),
    };
  }
}
