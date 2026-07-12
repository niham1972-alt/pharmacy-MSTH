import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SystemRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { signImpersonationToken } from '../../common/auth/impersonation-token';
import { PlatformStaff } from '../common/platform-staff.interface';
import { PlatformAuditService } from '../common/platform-audit.service';
import { StartImpersonationDto } from '../dto/platform.dto';

const IMPERSONATION_MAX_MINUTES = 30; // hard cap regardless of activity (spec §10)

const ROLE_TO_CLAIM: Record<SystemRole, string> = {
  SUPER_ADMIN: 'super_admin', ADMIN: 'admin', PHARMACIST: 'pharmacist',
  INVENTORY_MANAGER: 'inventory_manager', CASHIER: 'cashier', ACCOUNTANT: 'accountant', AUDITOR: 'auditor',
};

@Injectable()
export class ImpersonationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: PlatformAuditService,
  ) {}

  async start(staff: PlatformStaff, dto: StartImpersonationDto) {
    const tenant = await this.prisma.pharmacy.findUnique({ where: { id: dto.targetPharmacyId } });
    if (!tenant) {
      await this.audit.record(staff, 'IMPERSONATION_START_FAILED', 'IMPERSONATION', { targetPharmacyId: dto.targetPharmacyId, metadata: { reason: dto.reason, cause: 'TENANT_NOT_FOUND' } });
      throw new NotFoundException({ errorCode: 'TENANT_NOT_FOUND', message: 'Target tenant not found' });
    }
    if (tenant.status === 'ARCHIVED') {
      await this.audit.record(staff, 'IMPERSONATION_START_FAILED', 'IMPERSONATION', { targetPharmacyId: dto.targetPharmacyId, metadata: { cause: 'TENANT_ARCHIVED' } });
      throw new BadRequestException({ errorCode: 'TENANT_ARCHIVED', message: 'Cannot impersonate into an archived tenant.' });
    }

    const target = await this.prisma.user.findFirst({
      where: { id: dto.targetUserId, pharmacyId: dto.targetPharmacyId },
      include: { roles: true, branchAccess: true },
    });
    if (!target) {
      await this.audit.record(staff, 'IMPERSONATION_START_FAILED', 'IMPERSONATION', { targetPharmacyId: dto.targetPharmacyId, metadata: { cause: 'TARGET_USER_NOT_FOUND', targetUserId: dto.targetUserId } });
      throw new NotFoundException({ errorCode: 'TARGET_USER_NOT_FOUND', message: 'Target user not found in this tenant' });
    }
    if (target.status === 'DEACTIVATED') {
      throw new BadRequestException({ errorCode: 'TARGET_DEACTIVATED', message: 'Cannot impersonate a deactivated user.' });
    }

    const role = target.roles[0]?.role ?? 'CASHIER';
    const branchIds = target.branchAccess.map((b) => b.branchId);
    const defaultBranch = target.branchAccess.find((b) => b.isDefault)?.branchId ?? branchIds[0] ?? '';

    const now = new Date();
    const expiresAt = new Date(now.getTime() + IMPERSONATION_MAX_MINUTES * 60_000);
    const session = await this.prisma.impersonationSession.create({
      data: {
        platformStaffUserId: staff.id, platformStaffEmail: staff.email,
        targetPharmacyId: dto.targetPharmacyId, targetUserId: target.id, targetUserEmail: target.email,
        reason: dto.reason, expiresAt,
      },
    });

    const token = signImpersonationToken(
      this.config,
      {
        sub: target.authUserId,
        email: target.email,
        app_metadata: { role: ROLE_TO_CLAIM[role], pharmacyId: dto.targetPharmacyId, branchId: defaultBranch, accessibleBranchIds: branchIds, status: 'ACTIVE' },
        typ: 'impersonation',
        impersonatedBy: staff.id,
        impersonationSessionId: session.id,
      },
      IMPERSONATION_MAX_MINUTES * 60,
    );

    await this.audit.record(staff, 'IMPERSONATION_STARTED', 'IMPERSONATION', {
      entityId: session.id, targetPharmacyId: dto.targetPharmacyId,
      metadata: { reason: dto.reason, targetUserId: target.id, targetUserEmail: target.email, expiresAt: expiresAt.toISOString() },
    });

    return {
      sessionId: session.id,
      token,
      expiresAt: expiresAt.toISOString(),
      pharmacy: { id: tenant.id, businessName: tenant.businessName },
      targetUser: { id: target.id, name: target.name, email: target.email, role: ROLE_TO_CLAIM[role] },
    };
  }

  async end(staff: PlatformStaff, sessionId: string) {
    const session = await this.prisma.impersonationSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException({ errorCode: 'SESSION_NOT_FOUND', message: 'Impersonation session not found' });
    // SUPPORT may only end their own session; SUPER_ADMIN may end any.
    if (staff.role !== 'SUPER_ADMIN' && session.platformStaffUserId !== staff.id) {
      throw new ForbiddenException({ errorCode: 'NOT_OWN_SESSION', message: 'You can only end your own impersonation session.' });
    }
    if (session.endedAt) return { id: sessionId, alreadyEnded: true };
    await this.prisma.impersonationSession.update({ where: { id: sessionId }, data: { endedAt: new Date(), endedReason: 'ENDED' } });
    await this.audit.record(staff, 'IMPERSONATION_ENDED', 'IMPERSONATION', { entityId: sessionId, targetPharmacyId: session.targetPharmacyId });
    return { id: sessionId, ended: true };
  }

  async history(staff: PlatformStaff, limit = 100) {
    // SUPER_ADMIN sees all; SUPPORT sees only their own (spec §13).
    const rows = await this.prisma.impersonationSession.findMany({
      where: staff.role === 'SUPER_ADMIN' ? {} : { platformStaffUserId: staff.id },
      orderBy: { startedAt: 'desc' },
      take: Math.min(limit, 500),
    });
    const now = Date.now();
    return rows.map((s) => ({
      id: s.id, platformStaffEmail: s.platformStaffEmail, targetPharmacyId: s.targetPharmacyId,
      targetUserId: s.targetUserId, targetUserEmail: s.targetUserEmail, reason: s.reason,
      startedAt: s.startedAt.toISOString(), endedAt: s.endedAt?.toISOString() ?? null,
      endedReason: s.endedReason, expiresAt: s.expiresAt.toISOString(),
      active: !s.endedAt && s.expiresAt.getTime() > now,
    }));
  }
}
