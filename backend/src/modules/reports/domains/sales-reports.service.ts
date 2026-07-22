import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { ResolvedRange } from '../date-range.util';
import { ReportFilters, TabularReport } from '../interfaces/report-filters.interface';

const dec = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : typeof v === 'number' ? v : v.toNumber());
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Sales & customer reports (spec §2.3). Read-only over Module 4/8/10 data. */
@Injectable()
export class SalesReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private branches(user: AuthenticatedUser, branchId?: string): string[] {
    if (branchId) return user.accessibleBranchIds.includes(branchId) ? [branchId] : [];
    return user.accessibleBranchIds;
  }

  async salesRegister(user: AuthenticatedUser, range: ResolvedRange, filters: ReportFilters): Promise<TabularReport> {
    const branches = this.branches(user, filters.branchId);
    const sales = await this.prisma.sale.findMany({
      where: {
        pharmacyId: user.pharmacyId, branchId: { in: branches }, status: 'COMPLETED', saleDate: { gte: range.from, lte: range.to },
        ...(filters.cashierId ? { cashierId: filters.cashierId } : {}),
        ...(filters.paymentMethod ? { payments: { some: { method: filters.paymentMethod } } } : {}),
      },
      orderBy: { saleDate: 'asc' },
      take: 20000,
      include: { payments: { select: { method: true } }, _count: { select: { items: true } } },
    });
    const rows = sales.map((s) => ({
      saleNumber: s.saleNumber,
      date: s.saleDate.toISOString().slice(0, 10),
      items: s._count.items,
      subTotal: dec(s.subTotal),
      discount: dec(s.discountTotal),
      tax: dec(s.taxTotal),
      total: dec(s.grandTotal),
      methods: [...new Set(s.payments.map((p) => p.method))].join(', '),
    }));
    return {
      columns: [
        { key: 'saleNumber', label: 'Sale #' }, { key: 'date', label: 'Date' }, { key: 'items', label: 'Items', numeric: true },
        { key: 'subTotal', label: 'Subtotal', numeric: true }, { key: 'discount', label: 'Discount', numeric: true },
        { key: 'tax', label: 'Tax', numeric: true }, { key: 'total', label: 'Total', numeric: true }, { key: 'methods', label: 'Payment' },
      ],
      rows,
      summary: { transactions: rows.length, revenue: round2(rows.reduce((s, r) => s + r.total, 0)), tax: round2(rows.reduce((s, r) => s + r.tax, 0)) },
      meta: { dateFrom: range.from.toISOString(), dateTo: range.to.toISOString() },
    };
  }

  async topSelling(user: AuthenticatedUser, range: ResolvedRange, filters: ReportFilters): Promise<TabularReport> {
    const branches = this.branches(user, filters.branchId);
    if (branches.length === 0) return { columns: TOP_COLS, rows: [] };
    const metric = filters.metric === 'revenue' ? Prisma.sql`revenue` : Prisma.sql`"quantitySold"`;
    const limit = Math.min(200, Math.max(1, Number(filters.limit) || 25));
    const rows = await this.prisma.$queryRaw<Array<{ medicineId: string; name: string; quantitySold: bigint; revenue: Prisma.Decimal }>>(Prisma.sql`
      SELECT si."medicineId" AS "medicineId", COALESCE(m."brandName", m."genericName") AS name,
             SUM(si.quantity) AS "quantitySold", SUM(si."unitPrice" * si.quantity) AS revenue
      FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId" JOIN "Medicine" m ON m.id = si."medicineId"
      WHERE s."pharmacyId" = ${user.pharmacyId} AND s."branchId" IN (${Prisma.join(branches)})
        AND s.status = 'COMPLETED' AND s."saleDate" BETWEEN ${range.from} AND ${range.to}
      GROUP BY si."medicineId", m."brandName", m."genericName"
      ORDER BY ${metric} DESC LIMIT ${limit}
    `);
    return {
      columns: TOP_COLS,
      rows: rows.map((r) => ({ medicine: r.name, quantitySold: Number(r.quantitySold), revenue: round2(dec(r.revenue)) })),
      meta: { dateFrom: range.from.toISOString(), dateTo: range.to.toISOString(), metric: filters.metric ?? 'qty' },
    };
  }

  async salesReturns(user: AuthenticatedUser, range: ResolvedRange, filters: ReportFilters): Promise<TabularReport> {
    const branches = this.branches(user, filters.branchId);
    const items = await this.prisma.salesReturnItem.findMany({
      where: { salesReturn: { pharmacyId: user.pharmacyId, branchId: { in: branches }, returnDate: { gte: range.from, lte: range.to } } },
      select: { medicineId: true, quantityReturned: true, refundAmountForLine: true, reasonCode: true },
    });
    const by = new Map<string, { medicineId: string; reasonCode: string; qty: number; refund: number; count: number }>();
    for (const it of items) {
      const key = `${it.medicineId}|${it.reasonCode}`;
      const cur = by.get(key) ?? { medicineId: it.medicineId, reasonCode: it.reasonCode, qty: 0, refund: 0, count: 0 };
      cur.qty += it.quantityReturned; cur.refund += dec(it.refundAmountForLine); cur.count += 1;
      by.set(key, cur);
    }
    const medIds = [...new Set([...by.values()].map((v) => v.medicineId))];
    const meds = medIds.length ? await this.prisma.medicine.findMany({ where: { id: { in: medIds } }, select: { id: true, genericName: true, brandName: true } }) : [];
    const nameOf = new Map(meds.map((m) => [m.id, m.brandName ?? m.genericName]));
    const rows = [...by.values()].map((v) => ({ medicine: nameOf.get(v.medicineId) ?? v.medicineId, reason: v.reasonCode, quantityReturned: v.qty, refund: round2(v.refund), returns: v.count })).sort((a, b) => b.quantityReturned - a.quantityReturned);
    return {
      columns: [{ key: 'medicine', label: 'Medicine' }, { key: 'reason', label: 'Reason' }, { key: 'quantityReturned', label: 'Qty returned', numeric: true }, { key: 'refund', label: 'Refund', numeric: true }, { key: 'returns', label: '# returns', numeric: true }],
      rows,
      summary: { totalRefund: round2(rows.reduce((s, r) => s + r.refund, 0)), totalUnits: rows.reduce((s, r) => s + r.quantityReturned, 0) },
    };
  }

  async customerHistory(user: AuthenticatedUser, customerId: string, range: ResolvedRange): Promise<TabularReport> {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, pharmacyId: user.pharmacyId }, select: { id: true, name: true, phone: true } });
    if (!customer) throw new NotFoundException({ errorCode: 'CUSTOMER_NOT_FOUND', message: 'Customer not found.' });
    const sales = await this.prisma.sale.findMany({
      where: { pharmacyId: user.pharmacyId, customerId, status: 'COMPLETED', saleDate: { gte: range.from, lte: range.to } },
      orderBy: { saleDate: 'desc' }, take: 5000, include: { _count: { select: { items: true } } },
    });
    const rows = sales.map((s) => ({ saleNumber: s.saleNumber, date: s.saleDate.toISOString().slice(0, 10), items: s._count.items, total: dec(s.grandTotal) }));
    return {
      columns: [{ key: 'saleNumber', label: 'Sale #' }, { key: 'date', label: 'Date' }, { key: 'items', label: 'Items', numeric: true }, { key: 'total', label: 'Total', numeric: true }],
      rows,
      summary: { customer: customer.name, phone: customer.phone, purchases: rows.length, lifetimeSpend: round2(rows.reduce((s, r) => s + r.total, 0)) },
    };
  }
}

const TOP_COLS = [{ key: 'medicine', label: 'Medicine' }, { key: 'quantitySold', label: 'Qty sold', numeric: true }, { key: 'revenue', label: 'Revenue', numeric: true }];
