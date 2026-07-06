import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditSeverity, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ACTION_REGISTRY, CONTROLLED_SUBSTANCE_ACTIONS, actionLabel, isRegisteredAction } from './config/action-registry';
import { computeRecordHash } from './integrity/hash-chain.util';

interface AuditRow {
  id: string;
  createdAt: Date;
  action: string;
  entityType: string;
  entityId: string | null;
  performedBy: string;
  performedByName: string | null;
  severity: AuditSeverity;
  branchId: string | null;
  metadata: Prisma.JsonValue;
}

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  private buildWhere(pharmacyId: string, q: Record<string, string | undefined>): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = { pharmacyId };
    if (q.dateFrom || q.dateTo) {
      if (q.dateFrom && q.dateTo && new Date(q.dateFrom) > new Date(q.dateTo)) throw new BadRequestException({ errorCode: 'INVALID_DATE_RANGE', message: 'dateFrom must be on or before dateTo.' });
      where.createdAt = { ...(q.dateFrom ? { gte: new Date(q.dateFrom) } : {}), ...(q.dateTo ? { lte: new Date(q.dateTo) } : {}) };
    }
    if (q.performedBy) where.performedBy = q.performedBy;
    if (q.actionType) where.action = q.actionType;
    if (q.entityType) where.entityType = q.entityType;
    if (q.severity) where.severity = q.severity as AuditSeverity;
    if (q.branchId) where.branchId = q.branchId;
    if (q.search?.trim()) {
      const t = q.search.trim();
      where.OR = [{ action: { contains: t, mode: 'insensitive' } }, { entityId: { contains: t } }, { performedByName: { contains: t, mode: 'insensitive' } }];
    }
    return where;
  }

  /** Resolve actor names for rows whose denormalized snapshot is null (legacy rows). */
  private async withNames(rows: AuditRow[]) {
    const missing = [...new Set(rows.filter((r) => !r.performedByName).map((r) => r.performedBy))];
    const users = missing.length ? await this.prisma.user.findMany({ where: { authUserId: { in: missing } }, select: { authUserId: true, name: true } }) : [];
    const nameOf = new Map(users.map((u) => [u.authUserId, u.name]));
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      action: r.action,
      actionLabel: actionLabel(r.action),
      registered: isRegisteredAction(r.action),
      entityType: r.entityType,
      entityId: r.entityId,
      performedBy: r.performedBy,
      performedByName: r.performedByName ?? nameOf.get(r.performedBy) ?? null,
      severity: r.severity,
      branchId: r.branchId,
      metadata: r.metadata,
    }));
  }

  async list(user: AuthenticatedUser, q: Record<string, string | undefined>) {
    const page = q.page ? Number(q.page) : 1;
    const limit = Math.min(q.limit ? Number(q.limit) : 30, 100);
    const where = this.buildWhere(user.pharmacyId, q);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), data: await this.withNames(rows as AuditRow[]) };
  }

  /** Entity-scoped trail — powers AuditTrailTab embedded in other modules. */
  async entityTrail(user: AuthenticatedUser, entityType: string, entityId: string, page = 1, limit = 25) {
    const where: Prisma.AuditLogWhereInput = { pharmacyId: user.pharmacyId, entityType, entityId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), data: await this.withNames(rows as AuditRow[]) };
  }

  async userActivity(user: AuthenticatedUser, userIdOrAuthId: string, q: Record<string, string | undefined>) {
    // The URL param may be an app User.id or a raw authUserId (= performedBy). Resolve both.
    const u = await this.prisma.user.findFirst({ where: { pharmacyId: user.pharmacyId, OR: [{ id: userIdOrAuthId }, { authUserId: userIdOrAuthId }] }, select: { authUserId: true } });
    const performedBy = u?.authUserId ?? userIdOrAuthId;
    return this.list(user, { ...q, performedBy });
  }

  async sensitive(user: AuthenticatedUser, q: Record<string, string | undefined>) {
    const page = q.page ? Number(q.page) : 1;
    const limit = Math.min(q.limit ? Number(q.limit) : 30, 100);
    const where = { ...this.buildWhere(user.pharmacyId, q), severity: { in: [AuditSeverity.SENSITIVE, AuditSeverity.CRITICAL] } };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), data: await this.withNames(rows as AuditRow[]) };
  }

  async exportCsv(user: AuthenticatedUser, q: Record<string, string | undefined>): Promise<string> {
    // Export cap: 1 year window to keep generation performant (spec §10).
    const from = q.dateFrom ? new Date(q.dateFrom) : null;
    const to = q.dateTo ? new Date(q.dateTo) : null;
    if (from && to && to.getTime() - from.getTime() > 366 * 86400000) throw new BadRequestException({ errorCode: 'RANGE_TOO_LARGE', message: 'Export range cannot exceed 1 year. Narrow the date range.' });
    const where = this.buildWhere(user.pharmacyId, q);
    const rows = await this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50000 });
    const withNames = await this.withNames(rows as AuditRow[]);
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'AUDIT_LOG_EXPORTED', entityType: 'AUDIT_LOG', metadata: { filters: q, rowCount: withNames.length } });
    return this.toCsv(withNames);
  }

  async controlledSubstanceReport(user: AuthenticatedUser, q: Record<string, string | undefined>): Promise<string> {
    const where = { ...this.buildWhere(user.pharmacyId, q), action: { in: CONTROLLED_SUBSTANCE_ACTIONS } };
    const rows = await this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50000 });
    const withNames = await this.withNames(rows as AuditRow[]);
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'AUDIT_LOG_EXPORTED', entityType: 'AUDIT_LOG', metadata: { report: 'controlled-substance', rowCount: withNames.length } });
    return this.toCsv(withNames);
  }

  private toCsv(rows: Array<Record<string, unknown>>): string {
    const cols = ['createdAt', 'actionLabel', 'action', 'severity', 'entityType', 'entityId', 'performedByName', 'performedBy', 'branchId', 'metadata'];
    const esc = (v: unknown) => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return `"${s.replace(/"/g, '""')}"`; };
    return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  }

  /** Registry for the UI (labels + filter dropdown). */
  actionRegistry() {
    return ACTION_REGISTRY;
  }

  // =========================================================================
  // Tamper-evidence integrity check
  // =========================================================================
  async runIntegrityCheck(user: AuthenticatedUser) {
    const rows = await this.prisma.auditLog.findMany({ where: { pharmacyId: user.pharmacyId }, orderBy: { createdAt: 'asc' }, select: { id: true, pharmacyId: true, action: true, entityType: true, entityId: true, performedBy: true, severity: true, metadata: true, createdAt: true, recordHash: true, previousHash: true } });
    let previousHash: string | null = null;
    let brokenAt: string | null = null;
    let checked = 0;
    for (const r of rows) {
      // Rows written before Module 15 have no hash — skip them, re-anchor the chain
      // from the first hashed record (documented: legacy pre-chain rows).
      if (r.recordHash == null) { checked++; continue; }
      if (previousHash !== null && r.previousHash !== previousHash) { brokenAt = r.id; break; }
      const expected = computeRecordHash(r.previousHash ?? null, { id: r.id, pharmacyId: r.pharmacyId, action: r.action, entityType: r.entityType, entityId: r.entityId, performedBy: r.performedBy, severity: r.severity, metadata: r.metadata ?? null, createdAt: r.createdAt });
      if (expected !== r.recordHash) { brokenAt = r.id; break; }
      previousHash = r.recordHash;
      checked++;
    }
    const chainIntact = brokenAt === null;
    const check = await this.prisma.auditIntegrityCheck.create({ data: { pharmacyId: user.pharmacyId, recordsChecked: checked, chainIntact, brokenAtRecordId: brokenAt, notes: chainIntact ? 'Chain verified' : `Chain break detected at record ${brokenAt}` } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'INTEGRITY_CHECK_RUN', entityType: 'AUDIT_LOG', metadata: { chainIntact, recordsChecked: checked, brokenAt } });
    return { id: check.id, checkedAt: check.checkedAt.toISOString(), recordsChecked: checked, chainIntact, brokenAtRecordId: brokenAt };
  }

  async integrityStatus(user: AuthenticatedUser) {
    const last = await this.prisma.auditIntegrityCheck.findFirst({ where: { pharmacyId: user.pharmacyId }, orderBy: { checkedAt: 'desc' } });
    const totalRecords = await this.prisma.auditLog.count({ where: { pharmacyId: user.pharmacyId } });
    return { totalRecords, lastCheck: last ? { checkedAt: last.checkedAt.toISOString(), recordsChecked: last.recordsChecked, chainIntact: last.chainIntact, brokenAtRecordId: last.brokenAtRecordId } : null };
  }
}
