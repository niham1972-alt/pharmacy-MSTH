import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuditSeverity } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogEntry, AuditLogEntryRecord, AuditLogService } from './audit-log.interface';
import { defaultSeverityFor } from '../../modules/audit-logs/config/action-registry';
import { computeRecordHash } from '../../modules/audit-logs/integrity/hash-chain.util';
import { currentImpersonation } from '../context/impersonation-context';

/**
 * Module 15's authoritative `AuditLogService.record()` implementation, behind the
 * interface every module already calls. Design principles:
 *  - FAIL-SAFE: the whole write is wrapped in try/catch — an audit failure is
 *    logged to app monitoring but NEVER propagates to break the caller's own
 *    business transaction (callers invoke this AFTER their tx commits).
 *  - performedByName is denormalized from Module 16's User (cached 5 min) so the
 *    log stays human-readable even if the user is later removed — and so the hot
 *    path isn't a fresh DB lookup on every write for a busy cashier.
 *  - Per-pharmacy HASH-CHAIN: each record's hash incorporates the previous
 *    record's hash. The write is serialized per-pharmacy with a pg advisory lock
 *    so concurrent writes don't fork the chain.
 */
@Injectable()
export class PrismaAuditLogService implements AuditLogService {
  private readonly logger = new Logger('AuditLog');
  private readonly nameCache = new Map<string, { name: string; ts: number }>();
  private readonly NAME_TTL = 5 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  private async resolveName(authUserId: string): Promise<string | null> {
    const cached = this.nameCache.get(authUserId);
    if (cached && Date.now() - cached.ts < this.NAME_TTL) return cached.name;
    try {
      const u = await this.prisma.user.findFirst({ where: { authUserId }, select: { name: true } });
      const name = u?.name ?? null;
      if (name) this.nameCache.set(authUserId, { name, ts: Date.now() });
      return name;
    } catch {
      return null;
    }
  }

  async record(entry: AuditLogEntry): Promise<void> {
    try {
      if (!entry.action || !entry.entityType || !entry.userId || !entry.pharmacyId) {
        this.logger.warn(`Dropping malformed audit entry (missing required field): action=${entry.action}`);
        return;
      }
      const severity = (entry.severity as AuditSeverity) ?? defaultSeverityFor(entry.action);
      // If this write happened inside an impersonation session, stamp the real
      // platform-staff identity alongside the impersonated tenant user.
      const imp = currentImpersonation();
      const metadata = imp ? { ...(entry.metadata ?? {}), impersonatedBy: imp.impersonatedBy, impersonationSessionId: imp.impersonationSessionId } : entry.metadata;
      const performedByName = await this.resolveName(entry.userId);
      const id = randomUUID();
      const createdAt = new Date();

      await this.prisma.$transaction(async (tx) => {
        // Serialize audit writes per-pharmacy so the hash-chain doesn't fork.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${entry.pharmacyId}))`;
        const last = await tx.auditLog.findFirst({ where: { pharmacyId: entry.pharmacyId }, orderBy: { createdAt: 'desc' }, select: { recordHash: true } });
        const previousHash = last?.recordHash ?? null;
        const recordHash = computeRecordHash(previousHash, {
          id, pharmacyId: entry.pharmacyId, action: entry.action, entityType: entry.entityType,
          entityId: entry.entityId ?? null, performedBy: entry.userId, severity, metadata: metadata ?? null, createdAt,
        });
        await tx.auditLog.create({
          data: {
            id, pharmacyId: entry.pharmacyId, branchId: entry.branchId ?? null, action: entry.action,
            entityType: entry.entityType, entityId: entry.entityId ?? null, performedBy: entry.userId, performedByName,
            severity, metadata: metadata as never, previousHash, recordHash, createdAt,
          },
        });
      });
    } catch (error) {
      // Audit logging failures must never block the primary action.
      this.logger.error(`Failed to write audit log for action=${entry.action}`, error as Error);
    }
  }

  async findRecent(pharmacyId: string, branchId: string | undefined, limit: number, cursor?: string): Promise<AuditLogEntryRecord[]> {
    const records = await this.prisma.auditLog.findMany({
      where: { pharmacyId, ...(branchId ? { branchId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return records.map((r) => ({
      id: r.id, pharmacyId: r.pharmacyId, branchId: r.branchId, userId: r.performedBy,
      action: r.action, entityType: r.entityType, entityId: r.entityId,
      metadata: (r.metadata as Record<string, unknown>) ?? undefined, createdAt: r.createdAt,
    }));
  }
}
