import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

function dec(v: Prisma.Decimal | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : v.toNumber();
}

// Purely aggregates over Module 3's authoritative tables (read-only, no
// duplicated storage). POs that never became real orders (DRAFT/REJECTED/
// CANCELLED) are excluded from spend/performance.
const COUNTED_STATUSES: PurchaseOrderStatus[] = ['PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED'];
const OUTSTANDING_STATUSES: PurchaseOrderStatus[] = ['APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED'];
const OUTSTANDING_PAYMENT: PaymentStatus[] = ['UNPAID', 'PARTIALLY_PAID'];

@Injectable()
export class SupplierPerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Per-supplier performance derived from POs/GRNs (spec §2.3). */
  async performance(pharmacyId: string, supplierId: string) {
    const pos = await this.prisma.purchaseOrder.findMany({
      where: { pharmacyId, supplierId, status: { in: COUNTED_STATUSES } },
      select: { id: true, grandTotal: true, expectedDeliveryDate: true, orderDate: true, goodsReceipts: { select: { receivedDate: true, hasVariance: true }, orderBy: { receivedDate: 'asc' } } },
    });

    const totalPos = pos.length;
    const totalSpend = pos.reduce((s, p) => s + dec(p.grandTotal), 0);

    // On-time: among POs that had an expected date AND at least one GRN, how many
    // had their first receipt on/before the expected delivery date.
    const withExpectedAndReceived = pos.filter((p) => p.expectedDeliveryDate && p.goodsReceipts.length > 0);
    const onTime = withExpectedAndReceived.filter((p) => p.goodsReceipts[0].receivedDate.getTime() <= p.expectedDeliveryDate!.getTime()).length;
    const onTimeRate = withExpectedAndReceived.length > 0 ? Math.round((onTime / withExpectedAndReceived.length) * 1000) / 10 : null;

    // Variance frequency across all GRNs for this supplier.
    const allGrns = pos.flatMap((p) => p.goodsReceipts);
    const varianceGrns = allGrns.filter((g) => g.hasVariance).length;
    const varianceRate = allGrns.length > 0 ? Math.round((varianceGrns / allGrns.length) * 1000) / 10 : null;

    // Average payment turnaround: days from orderDate to first payment.
    const payments = await this.prisma.purchasePayment.findMany({ where: { pharmacyId, purchaseOrder: { supplierId } }, select: { paymentDate: true, purchaseOrder: { select: { orderDate: true } } } });
    const turnarounds = payments.map((pm) => (pm.paymentDate.getTime() - pm.purchaseOrder.orderDate.getTime()) / 86400000).filter((d) => d >= 0);
    const avgPaymentTurnaroundDays = turnarounds.length > 0 ? Math.round((turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length) * 10) / 10 : null;

    return { totalPos, totalSpend: Math.round(totalSpend * 100) / 100, grnCount: allGrns.length, onTimeRate, varianceRate, varianceIncidents: varianceGrns, avgPaymentTurnaroundDays };
  }

  /** Outstanding payables for one supplier (spec §2.4). */
  async payables(pharmacyId: string, supplierId: string) {
    const pos = await this.prisma.purchaseOrder.findMany({
      where: { pharmacyId, supplierId, status: { in: OUTSTANDING_STATUSES }, paymentStatus: { in: OUTSTANDING_PAYMENT } },
      select: { id: true, poNumber: true, grandTotal: true, amountPaid: true, dueDate: true, orderDate: true, paymentStatus: true },
      orderBy: { orderDate: 'asc' },
    });
    const now = Date.now();
    const items = pos.map((p) => {
      const outstanding = Math.round((dec(p.grandTotal) - dec(p.amountPaid)) * 100) / 100;
      const ageDays = Math.floor((now - p.orderDate.getTime()) / 86400000);
      const overdue = !!p.dueDate && p.dueDate.getTime() < now;
      return { purchaseOrderId: p.id, poNumber: p.poNumber, grandTotal: dec(p.grandTotal), amountPaid: dec(p.amountPaid), outstanding, dueDate: p.dueDate?.toISOString() ?? null, ageDays, overdue, paymentStatus: p.paymentStatus };
    }).filter((i) => i.outstanding > 0);
    const totalOutstanding = Math.round(items.reduce((s, i) => s + i.outstanding, 0) * 100) / 100;
    const oldestUnpaidAgeDays = items.length ? Math.max(...items.map((i) => i.ageDays)) : 0;
    return { totalOutstanding, oldestUnpaidAgeDays, overdueCount: items.filter((i) => i.overdue).length, items };
  }

  /** All-suppliers payables overview (spec §2.4). Archived suppliers with debt still surface. */
  async payablesSummary(pharmacyId: string) {
    const grouped = await this.prisma.purchaseOrder.groupBy({
      by: ['supplierId'],
      where: { pharmacyId, status: { in: OUTSTANDING_STATUSES }, paymentStatus: { in: OUTSTANDING_PAYMENT } },
      _sum: { grandTotal: true, amountPaid: true },
      _count: { _all: true },
    });
    const supplierIds = grouped.map((g) => g.supplierId);
    const suppliers = await this.prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, companyName: true, isActive: true } });
    const nameOf = new Map(suppliers.map((s) => [s.id, s]));
    const rows = grouped
      .map((g) => {
        const outstanding = Math.round((dec(g._sum?.grandTotal) - dec(g._sum?.amountPaid)) * 100) / 100;
        const s = nameOf.get(g.supplierId);
        return { supplierId: g.supplierId, companyName: s?.companyName ?? g.supplierId, isActive: s?.isActive ?? true, openPoCount: g._count._all, outstanding };
      })
      .filter((r) => r.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding);
    return { totalOutstanding: Math.round(rows.reduce((s, r) => s + r.outstanding, 0) * 100) / 100, suppliers: rows };
  }

  /** Batched per-supplier spend + outstanding for the list page (no N+1). */
  async listAggregates(pharmacyId: string, supplierIds: string[]) {
    if (supplierIds.length === 0) return new Map<string, { totalSpend: number; outstanding: number }>();
    const spend = await this.prisma.purchaseOrder.groupBy({ by: ['supplierId'], where: { pharmacyId, supplierId: { in: supplierIds }, status: { in: COUNTED_STATUSES } }, _sum: { grandTotal: true } });
    const outstanding = await this.prisma.purchaseOrder.groupBy({ by: ['supplierId'], where: { pharmacyId, supplierId: { in: supplierIds }, status: { in: OUTSTANDING_STATUSES }, paymentStatus: { in: OUTSTANDING_PAYMENT } }, _sum: { grandTotal: true, amountPaid: true } });
    const spendOf = new Map(spend.map((s) => [s.supplierId, dec(s._sum?.grandTotal)]));
    const outOf = new Map(outstanding.map((o) => [o.supplierId, Math.round((dec(o._sum?.grandTotal) - dec(o._sum?.amountPaid)) * 100) / 100]));
    const out = new Map<string, { totalSpend: number; outstanding: number }>();
    for (const id of supplierIds) out.set(id, { totalSpend: Math.round((spendOf.get(id) ?? 0) * 100) / 100, outstanding: Math.max(0, outOf.get(id) ?? 0) });
    return out;
  }
}
