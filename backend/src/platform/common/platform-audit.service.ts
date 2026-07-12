import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformStaff } from './platform-staff.interface';

/** This layer's OWN audit trail (PlatformAuditLog) — the most sensitive events in
 *  the system given their cross-tenant blast radius. Fail-safe: a logging failure
 *  never breaks the caller. */
@Injectable()
export class PlatformAuditService {
  private readonly logger = new Logger('PlatformAudit');

  constructor(private readonly prisma: PrismaService) {}

  async record(
    staff: PlatformStaff,
    action: string,
    entityType: string,
    opts: { entityId?: string; targetPharmacyId?: string; metadata?: Record<string, unknown> } = {},
  ): Promise<void> {
    try {
      await this.prisma.platformAuditLog.create({
        data: {
          platformStaffUserId: staff.id,
          platformStaffEmail: staff.email,
          action,
          entityType,
          entityId: opts.entityId ?? null,
          targetPharmacyId: opts.targetPharmacyId ?? null,
          metadata: (opts.metadata ?? undefined) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write platform audit for action=${action}`, err as Error);
    }
  }

  async list(limit = 100, action?: string, targetPharmacyId?: string) {
    return this.prisma.platformAuditLog.findMany({
      where: { ...(action ? { action } : {}), ...(targetPharmacyId ? { targetPharmacyId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }
}
