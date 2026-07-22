import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { ResolvedRange } from '../date-range.util';
import { TabularReport } from '../interfaces/report-filters.interface';

const dec = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : typeof v === 'number' ? v : v.toNumber());
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Supplier & procurement reports (spec §2.1/§2.4). Read-only over Module 3/7/9 data. */
@Injectable()
export class SupplierReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private branches(user: AuthenticatedUser, branchId?: string): string[] {
    if (branchId) return user.accessibleBranchIds.includes(branchId) ? [branchId] : [];
    return user.accessibleBranchIds;
  }

  async purchaseSummary(user: AuthenticatedUser, range: ResolvedRange, branchId?: string): Promise<TabularReport> {
    const branches = this.branches(user, branchId);
    const grouped = await this.prisma.purchaseOrder.groupBy({
      by: ['supplierId'], where: { pharmacyId: user.pharmacyId, branchId: { in: branches }, createdAt: { gte: range.from, lte: range.to }, status: { notIn: ['DRAFT', 'CANCELLED', 'REJECTED'] } },
      _sum: { grandTotal: true, taxTotal: true }, _count: { _all: true },
    });
    const names = await this.supplierNames(user.pharmacyId, grouped.map((g) => g.supplierId));
    const rows = grouped.map((g) => ({ supplier: names.get(g.supplierId) ?? g.supplierId, orders: g._count._all, spend: round2(dec(g._sum.grandTotal)), tax: round2(dec(g._sum.taxTotal)) })).sort((a, b) => b.spend - a.spend);
    return {
      columns: [{ key: 'supplier', label: 'Supplier' }, { key: 'orders', label: 'Orders', numeric: true }, { key: 'spend', label: 'Spend', numeric: true }, { key: 'tax', label: 'Tax', numeric: true }],
      rows, summary: { totalSpend: round2(rows.reduce((s, r) => s + r.spend, 0)), suppliers: rows.length },
      meta: { dateFrom: range.from.toISOString(), dateTo: range.to.toISOString() },
    };
  }

  async supplierPerformance(user: AuthenticatedUser, range: ResolvedRange, branchId?: string): Promise<TabularReport> {
    const branches = this.branches(user, branchId);
    const pos = await this.prisma.purchaseOrder.findMany({
      where: { pharmacyId: user.pharmacyId, branchId: { in: branches }, createdAt: { gte: range.from, lte: range.to }, status: { notIn: ['DRAFT', 'CANCELLED', 'REJECTED'] } },
      select: { supplierId: true, grandTotal: true, expectedDeliveryDate: true, goodsReceipts: { select: { receivedDate: true, hasVariance: true } } },
    });
    const by = new Map<string, { orders: number; spend: number; grns: number; variances: number; onTime: number; assessable: number }>();
    for (const po of pos) {
      const cur = by.get(po.supplierId) ?? { orders: 0, spend: 0, grns: 0, variances: 0, onTime: 0, assessable: 0 };
      cur.orders += 1; cur.spend += dec(po.grandTotal);
      for (const g of po.goodsReceipts) {
        cur.grns += 1;
        if (g.hasVariance) cur.variances += 1;
        if (po.expectedDeliveryDate) { cur.assessable += 1; if (g.receivedDate.getTime() <= po.expectedDeliveryDate.getTime()) cur.onTime += 1; }
      }
      by.set(po.supplierId, cur);
    }
    const names = await this.supplierNames(user.pharmacyId, [...by.keys()]);
    const rows = [...by.entries()].map(([id, v]) => ({
      supplier: names.get(id) ?? id, orders: v.orders, spend: round2(v.spend), receipts: v.grns,
      onTimePercent: v.assessable ? round2((v.onTime / v.assessable) * 100) : null,
      varianceRatePercent: v.grns ? round2((v.variances / v.grns) * 100) : 0,
    })).sort((a, b) => b.spend - a.spend);
    return {
      columns: [
        { key: 'supplier', label: 'Supplier' }, { key: 'orders', label: 'Orders', numeric: true }, { key: 'spend', label: 'Spend', numeric: true },
        { key: 'receipts', label: 'Receipts', numeric: true }, { key: 'onTimePercent', label: 'On-time %', numeric: true }, { key: 'varianceRatePercent', label: 'Variance %', numeric: true },
      ],
      rows, meta: { dateFrom: range.from.toISOString(), dateTo: range.to.toISOString() },
    };
  }

  async purchaseReturns(user: AuthenticatedUser, range: ResolvedRange, branchId?: string): Promise<TabularReport> {
    const branches = this.branches(user, branchId);
    const grouped = await this.prisma.purchaseReturn.groupBy({
      by: ['supplierId', 'settlementStatus'], where: { pharmacyId: user.pharmacyId, branchId: { in: branches }, returnDate: { gte: range.from, lte: range.to } },
      _sum: { expectedCreditAmount: true, actualCreditedAmount: true }, _count: { _all: true },
    });
    const names = await this.supplierNames(user.pharmacyId, grouped.map((g) => g.supplierId));
    const rows = grouped.map((g) => ({ supplier: names.get(g.supplierId) ?? g.supplierId, settlement: g.settlementStatus, returns: g._count._all, expectedCredit: round2(dec(g._sum.expectedCreditAmount)), actualCredit: round2(dec(g._sum.actualCreditedAmount)) })).sort((a, b) => b.expectedCredit - a.expectedCredit);
    return {
      columns: [{ key: 'supplier', label: 'Supplier' }, { key: 'settlement', label: 'Settlement' }, { key: 'returns', label: '# returns', numeric: true }, { key: 'expectedCredit', label: 'Expected credit', numeric: true }, { key: 'actualCredit', label: 'Actual credit', numeric: true }],
      rows, summary: { totalExpectedCredit: round2(rows.reduce((s, r) => s + r.expectedCredit, 0)) },
      meta: { dateFrom: range.from.toISOString(), dateTo: range.to.toISOString() },
    };
  }

  private async supplierNames(pharmacyId: string, ids: string[]): Promise<Map<string, string>> {
    const uniq = [...new Set(ids)];
    if (uniq.length === 0) return new Map();
    const rows = await this.prisma.supplier.findMany({ where: { pharmacyId, id: { in: uniq } }, select: { id: true, companyName: true } });
    return new Map(rows.map((s) => [s.id, s.companyName]));
  }
}
