import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { SupabaseAdminService } from './supabase-admin.service';
import { AuthorizationService } from './authorization.service';
import { RequestStepUpDto, VerifyStepUpDto } from './dto/users.dto';

const STEP_UP_WINDOW_MS = Number(process.env.STEP_UP_WINDOW_MS ?? 120_000); // 2 minutes

/**
 * Step-up (re-authentication) for elevated actions — the mechanism Module 4
 * (discount approval, prescription verification) and Module 6 (batch write-off)
 * call into. A cashier requests elevation for a specific action; an elevated
 * user (pharmacist/admin) provides their OWN password inline; this verifies both
 * the password (via Supabase) AND that the verifier genuinely holds the required
 * role right now (re-checked server-side, never trusting a stale claim).
 */
@Injectable()
export class StepUpAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseAdminService,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditLogService,
  ) {}

  async request(user: AuthenticatedUser, dto: RequestStepUpDto) {
    const required = dto.requiredRole as SystemRole;
    // Requesting elevation to a non-elevated role defeats the purpose (spec §10).
    if (!['SUPER_ADMIN', 'ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER'].includes(required)) {
      throw new BadRequestException({ errorCode: 'INVALID_REQUIRED_ROLE', message: 'Step-up must require an elevated role.' });
    }
    const rec = await this.prisma.stepUpVerification.create({
      data: { pharmacyId: user.pharmacyId, requestedByUserId: user.userId, actionType: dto.actionType, referenceModule: dto.referenceModule, referenceId: dto.referenceId, requiredRole: required, expiresAt: new Date(Date.now() + STEP_UP_WINDOW_MS) },
    });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'STEP_UP_REQUESTED', entityType: 'STEP_UP', entityId: rec.id, metadata: { actionType: dto.actionType, requiredRole: required } });
    return { id: rec.id, expiresAt: rec.expiresAt.toISOString(), requiredRole: required };
  }

  async verify(user: AuthenticatedUser, id: string, dto: VerifyStepUpDto) {
    const rec = await this.prisma.stepUpVerification.findUnique({ where: { id } });
    if (!rec || rec.pharmacyId !== user.pharmacyId) throw new NotFoundException({ errorCode: 'STEP_UP_NOT_FOUND', message: 'Step-up request not found' });
    if (rec.status !== 'PENDING') throw new BadRequestException({ errorCode: 'STEP_UP_NOT_PENDING', message: `This request is already ${rec.status}.` });
    if (rec.expiresAt.getTime() < Date.now()) {
      await this.prisma.stepUpVerification.update({ where: { id }, data: { status: 'EXPIRED', resolvedAt: new Date() } });
      throw new BadRequestException({ errorCode: 'STEP_UP_EXPIRED', message: 'This authorization request has expired. Please try again.' });
    }

    // 1. Verify the password against Supabase Auth (never handled locally).
    const verified = await this.supabase.verifyPassword(dto.email, dto.password);
    // 2. Re-check the verifier's ACTUAL current role server-side (paranoid, spec §17).
    let ok = false;
    if (verified) {
      const verifierUser = await this.prisma.user.findFirst({ where: { pharmacyId: user.pharmacyId, authUserId: verified.authUserId }, include: { roles: true } });
      const roles = verifierUser ? verifierUser.roles.map((r) => r.role) : [];
      ok = this.authz.roleSatisfies(roles, rec.requiredRole) && (!verifierUser || verifierUser.status === 'ACTIVE');
      if (ok) {
        await this.prisma.stepUpVerification.update({ where: { id }, data: { status: 'APPROVED', verifiedByUserId: verified.authUserId, resolvedAt: new Date() } });
        await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: verified.authUserId, action: 'STEP_UP_APPROVED', entityType: 'STEP_UP', entityId: id, metadata: { actionType: rec.actionType, requestedBy: rec.requestedByUserId } });
        return { id, status: 'APPROVED', verifiedByUserId: verified.authUserId };
      }
    }
    // Generic failure — don't leak whether it was the password or the role (spec §12).
    await this.prisma.stepUpVerification.update({ where: { id }, data: { status: 'DENIED', resolvedAt: new Date() } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'STEP_UP_DENIED', entityType: 'STEP_UP', entityId: id, metadata: { reason: verified ? 'insufficient_role' : 'bad_credentials' } });
    throw new ForbiddenException({ errorCode: 'STEP_UP_FAILED', message: 'Verification failed.' });
  }

  async status(user: AuthenticatedUser, id: string) {
    await this.authz.expireStale();
    const rec = await this.prisma.stepUpVerification.findUnique({ where: { id } });
    if (!rec || rec.pharmacyId !== user.pharmacyId) throw new NotFoundException({ errorCode: 'STEP_UP_NOT_FOUND', message: 'Step-up request not found' });
    return { id: rec.id, status: rec.status, verifiedByUserId: rec.verifiedByUserId, expiresAt: rec.expiresAt.toISOString() };
  }
}
