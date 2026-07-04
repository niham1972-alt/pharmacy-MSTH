import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogEntry, AuditLogEntryRecord, AuditLogService } from './audit-log.interface';

/**
 * Backed by the stub `AuditLog` Prisma table so activity-feed reads and
 * acknowledgement/preference writes are functionally consistent today.
 * Module 15 will replace this with a richer implementation (retention
 * policies, export, tamper-evidence) behind the same interface.
 */
@Injectable()
export class PrismaAuditLogService implements AuditLogService {
  private readonly logger = new Logger('AuditLog');

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          pharmacyId: entry.pharmacyId,
          branchId: entry.branchId,
          userId: entry.userId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: entry.metadata as never,
        },
      });
    } catch (error) {
      // Audit logging failures must never block the primary action.
      this.logger.error(`Failed to write audit log for action=${entry.action}`, error as Error);
    }
  }

  async findRecent(
    pharmacyId: string,
    branchId: string | undefined,
    limit: number,
    cursor?: string,
  ): Promise<AuditLogEntryRecord[]> {
    const records = await this.prisma.auditLog.findMany({
      where: {
        pharmacyId,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    return records.map((r) => ({
      id: r.id,
      pharmacyId: r.pharmacyId,
      branchId: r.branchId,
      userId: r.userId,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      metadata: (r.metadata as Record<string, unknown>) ?? undefined,
      createdAt: r.createdAt,
    }));
  }
}
