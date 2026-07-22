import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { CONTROLLED_SUBSTANCE_ACTIONS } from '../../audit-logs/config/action-registry';
import { ResolvedRange } from '../date-range.util';
import { ReportFilters, TabularReport } from '../interfaces/report-filters.interface';

const dec = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : typeof v === 'number' ? v : v.toNumber());
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Compliance & loss reports (spec §2.3/§2.4). Read-only over Module 11/15 data. */
@Injectable()
export class ComplianceReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private branches(user: AuthenticatedUser, branchId?: string): string[] {
    if (branchId) return user.accessibleBranchIds.includes(branchId) ? [branchId] : [];
    return user.accessibleBranchIds;
  }

  /** Controlled-substance dispensing log — the report-formatted view of Module 15's data. */
  async controlledSubstanceLog(user: AuthenticatedUser, range: ResolvedRange): Promise<TabularReport> {
    const logs = await this.prisma.auditLog.findMany({
      where: { pharmacyId: user.pharmacyId, action: { in: CONTROLLED_SUBSTANCE_ACTIONS }, createdAt: { gte: range.from, lte: range.to } },
      orderBy: { createdAt: 'desc' }, take: 20000,
    });
    const rows = logs.map((l) => {
      const m = (l.metadata ?? {}) as Record<string, unknown>;
      return {
        date: l.createdAt.toISOString().slice(0, 19).replace('T', ' '),
        action: l.action,
        medicine: (m.medicine as string) ?? (m.medicineName as string) ?? '—',
        quantity: (m.quantityDispensed as number) ?? (m.quantity as number) ?? null,
        patient: (m.patientName as string) ?? '—',
        prescriber: (m.prescribingDoctor as string) ?? '—',
        performedBy: l.performedByName ?? l.performedBy,
      };
    });
    return {
      columns: [
        { key: 'date', label: 'Date/time' }, { key: 'action', label: 'Event' }, { key: 'medicine', label: 'Medicine' },
        { key: 'quantity', label: 'Qty', numeric: true }, { key: 'patient', label: 'Patient' }, { key: 'prescriber', label: 'Prescriber' }, { key: 'performedBy', label: 'Dispensed by' },
      ],
      rows, summary: { events: rows.length }, meta: { dateFrom: range.from.toISOString(), dateTo: range.to.toISOString() },
    };
  }

  /** Curated audit summary — sensitive/critical events grouped by action, for compliance review. */
  async auditSummary(user: AuthenticatedUser, range: ResolvedRange): Promise<TabularReport> {
    const grouped = await this.prisma.auditLog.groupBy({
      by: ['action', 'severity'], where: { pharmacyId: user.pharmacyId, severity: { in: ['SENSITIVE', 'CRITICAL'] }, createdAt: { gte: range.from, lte: range.to } }, _count: { _all: true },
    });
    const rows = grouped.map((g) => ({ action: g.action, severity: g.severity, count: g._count._all })).sort((a, b) => b.count - a.count);
    return {
      columns: [{ key: 'action', label: 'Event type' }, { key: 'severity', label: 'Severity' }, { key: 'count', label: 'Count', numeric: true }],
      rows, summary: { distinctEventTypes: rows.length, totalEvents: rows.reduce((s, r) => s + r.count, 0) },
      meta: { dateFrom: range.from.toISOString(), dateTo: range.to.toISOString() },
    };
  }

  /** Loss/shrinkage — the report-formatted view of Module 11's negative adjustments. */
  async shrinkage(user: AuthenticatedUser, range: ResolvedRange, filters: ReportFilters): Promise<TabularReport> {
    const branches = this.branches(user, filters.branchId);
    const adjustments = await this.prisma.stockAdjustment.findMany({
      where: { pharmacyId: user.pharmacyId, branchId: { in: branches }, direction: 'DECREASE', status: { in: ['AUTO_APPROVED', 'APPROVED'] }, requestedAt: { gte: range.from, lte: range.to } },
      select: { reasonCode: true, quantity: true, unitCostAtRequest: true },
    });
    const by = new Map<string, { qty: number; value: number; count: number }>();
    for (const a of adjustments) {
      const cur = by.get(a.reasonCode) ?? { qty: 0, value: 0, count: 0 };
      cur.qty += a.quantity; cur.value += dec(a.unitCostAtRequest) * a.quantity; cur.count += 1;
      by.set(a.reasonCode, cur);
    }
    const rows = [...by.entries()].map(([reason, v]) => ({ reason, unitsLost: v.qty, valueLost: round2(v.value), adjustments: v.count })).sort((a, b) => b.valueLost - a.valueLost);
    return {
      columns: [{ key: 'reason', label: 'Reason' }, { key: 'unitsLost', label: 'Units lost', numeric: true }, { key: 'valueLost', label: 'Value lost', numeric: true }, { key: 'adjustments', label: '# adjustments', numeric: true }],
      rows, summary: { totalValueLost: round2(rows.reduce((s, r) => s + r.valueLost, 0)), totalUnitsLost: rows.reduce((s, r) => s + r.unitsLost, 0) },
      meta: { dateFrom: range.from.toISOString(), dateTo: range.to.toISOString() },
    };
  }
}
