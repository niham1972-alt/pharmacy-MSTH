import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TrendGranularity } from './dto/get-sales-trend.dto';
import { TopSellingMetric } from './dto/get-top-selling.dto';

export function toNumber(value: Prisma.Decimal | number | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return value.toNumber();
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getPharmacySettings(pharmacyId: string): Promise<{
    currency: string;
    timezone: string;
    expiryThresholdDays: number;
  }> {
    const settings = await this.prisma.pharmacySettings.findUnique({ where: { pharmacyId } });
    return {
      currency: settings?.currency ?? 'USD',
      timezone: settings?.timezone ?? 'UTC',
      expiryThresholdDays: settings?.expiryThresholdDays ?? 90,
    };
  }

  async getSalesAggregate(
    pharmacyId: string,
    branchId: string,
    from: Date,
    to: Date,
    cashierId?: string,
  ): Promise<{ amount: number; count: number }> {
    const result = await this.prisma.sale.aggregate({
      where: {
        pharmacyId,
        branchId,
        status: 'COMPLETED',
        saleDate: { gte: from, lte: to },
        ...(cashierId ? { cashierId } : {}),
      },
      _sum: { grandTotal: true },
      _count: { _all: true },
    });

    return { amount: toNumber(result._sum.grandTotal), count: result._count._all };
  }

  /** Profit requires a per-item join sum — not expressible via a single-table `aggregate`. */
  async getProfitAggregate(
    pharmacyId: string,
    branchId: string,
    from: Date,
    to: Date,
    cashierId?: string,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ profit: Prisma.Decimal | null }>>(
      Prisma.sql`
        SELECT COALESCE(SUM((si."unitPrice" - si."unitCost") * si."quantity"), 0) AS profit
        FROM "SaleItem" si
        JOIN "Sale" s ON s.id = si."saleId"
        WHERE s."pharmacyId" = ${pharmacyId}
          AND s."branchId" = ${branchId}
          AND s.status = 'COMPLETED'
          AND s."saleDate" BETWEEN ${from} AND ${to}
          ${cashierId ? Prisma.sql`AND s."cashierId" = ${cashierId}` : Prisma.empty}
      `,
    );

    return toNumber(rows[0]?.profit);
  }

  async getMonthPurchasesTotal(pharmacyId: string, branchId: string, from: Date, to: Date): Promise<number> {
    const result = await this.prisma.purchaseOrder.aggregate({
      where: { pharmacyId, branchId, createdAt: { gte: from, lte: to } },
      _sum: { grandTotal: true },
    });
    return toNumber(result._sum.grandTotal);
  }

  async getMonthExpensesTotal(pharmacyId: string, branchId: string, from: Date, to: Date): Promise<number> {
    const result = await this.prisma.expense.aggregate({
      where: { pharmacyId, branchId, expenseDate: { gte: from, lte: to } },
      _sum: { amount: true },
    });
    return toNumber(result._sum.amount);
  }

  /** "currentStock <= reorderLevel" compares two columns — Prisma's `where` builder can't
   * express that, so this is a parameterized raw count (spec §11 low-stock definition). */
  async getLowStockCount(pharmacyId: string, branchId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`
        SELECT COUNT(*) AS count FROM "Medicine"
        WHERE "pharmacyId" = ${pharmacyId} AND "branchId" = ${branchId} AND "isActive" = true
          AND "currentStock" > 0 AND "currentStock" <= "reorderLevel"
      `,
    );
    return Number(rows[0]?.count ?? 0);
  }

  async getOutOfStockCount(pharmacyId: string, branchId: string): Promise<number> {
    return this.prisma.medicine.count({
      where: { pharmacyId, branchId, isActive: true, currentStock: 0 },
    });
  }

  async getExpiringSoonCount(pharmacyId: string, branchId: string, thresholdDays: number): Promise<number> {
    const now = new Date();
    const threshold = new Date(now.getTime() + thresholdDays * 24 * 60 * 60 * 1000);
    return this.prisma.medicineBatch.count({
      where: { pharmacyId, branchId, expiryDate: { gte: now, lte: threshold }, currentQuantity: { gt: 0 }, isRecalled: false },
    });
  }

  async getPendingPurchaseOrdersCount(pharmacyId: string, branchId: string): Promise<number> {
    return this.prisma.purchaseOrder.count({
      where: { pharmacyId, branchId, status: { in: ['PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED'] } },
    });
  }

  async getSalesTrend(
    pharmacyId: string,
    branchId: string,
    from: Date,
    to: Date,
    granularity: TrendGranularity,
    cashierId?: string,
  ): Promise<Array<{ bucket: Date; revenue: Prisma.Decimal | null; profit: Prisma.Decimal | null }>> {
    return this.prisma.$queryRaw<Array<{ bucket: Date; revenue: Prisma.Decimal | null; profit: Prisma.Decimal | null }>>(
      // Revenue is summed per-sale and profit per-item in separate subqueries,
      // then joined by bucket — a single Sale⋈SaleItem join would fan-out
      // grandTotal by the line count and inflate revenue.
      Prisma.sql`
        SELECT rev.bucket AS bucket, rev.revenue AS revenue, COALESCE(pr.profit, 0) AS profit
        FROM (
          SELECT date_trunc(${granularity}, s."saleDate") AS bucket, SUM(s."grandTotal") AS revenue
          FROM "Sale" s
          WHERE s."pharmacyId" = ${pharmacyId} AND s."branchId" = ${branchId}
            AND s.status = 'COMPLETED' AND s."saleDate" BETWEEN ${from} AND ${to}
            ${cashierId ? Prisma.sql`AND s."cashierId" = ${cashierId}` : Prisma.empty}
          GROUP BY bucket
        ) rev
        LEFT JOIN (
          SELECT date_trunc(${granularity}, s."saleDate") AS bucket,
                 SUM((si."unitPrice" - si."unitCost") * si."quantity") AS profit
          FROM "Sale" s
          JOIN "SaleItem" si ON si."saleId" = s.id
          WHERE s."pharmacyId" = ${pharmacyId} AND s."branchId" = ${branchId}
            AND s.status = 'COMPLETED' AND s."saleDate" BETWEEN ${from} AND ${to}
            ${cashierId ? Prisma.sql`AND s."cashierId" = ${cashierId}` : Prisma.empty}
          GROUP BY bucket
        ) pr ON rev.bucket = pr.bucket
        ORDER BY rev.bucket ASC
      `,
    );
  }

  async getTopSelling(
    pharmacyId: string,
    branchId: string,
    from: Date,
    to: Date,
    metric: TopSellingMetric,
    limit: number,
  ): Promise<Array<{ medicineId: string; name: string; quantitySold: bigint; revenue: Prisma.Decimal }>> {
    // Alias is emitted quoted (`AS "quantitySold"`), so it's case-sensitive —
    // the ORDER BY must quote it too, otherwise Postgres folds it to lowercase
    // (`quantitysold`) and errors with "column does not exist".
    const orderColumn = metric === 'qty' ? Prisma.sql`"quantitySold"` : Prisma.sql`revenue`;
    return this.prisma.$queryRaw<
      Array<{ medicineId: string; name: string; quantitySold: bigint; revenue: Prisma.Decimal }>
    >(
      Prisma.sql`
        SELECT si."medicineId" AS "medicineId",
               COALESCE(m."brandName", m."genericName") AS name,
               SUM(si.quantity) AS "quantitySold",
               SUM(si."unitPrice" * si.quantity) AS revenue
        FROM "SaleItem" si
        JOIN "Sale" s ON s.id = si."saleId"
        JOIN "Medicine" m ON m.id = si."medicineId"
        WHERE s."pharmacyId" = ${pharmacyId}
          AND s."branchId" = ${branchId}
          AND s.status = 'COMPLETED'
          AND s."saleDate" BETWEEN ${from} AND ${to}
        GROUP BY si."medicineId", m."brandName", m."genericName"
        ORDER BY ${orderColumn} DESC
        LIMIT ${limit}
      `,
    );
  }

  async getLowStockMedicines(pharmacyId: string, branchId: string): Promise<
    Array<{ id: string; name: string; currentStock: number; reorderLevel: number }>
  > {
    return this.prisma.$queryRaw(
      Prisma.sql`
        SELECT id, COALESCE("brandName", "genericName") AS name, "currentStock", "reorderLevel" FROM "Medicine"
        WHERE "pharmacyId" = ${pharmacyId} AND "branchId" = ${branchId} AND "isActive" = true
          AND "currentStock" > 0 AND "currentStock" <= "reorderLevel"
        ORDER BY "currentStock" ASC
      `,
    );
  }

  async getOutOfStockMedicines(pharmacyId: string, branchId: string): Promise<
    Array<{ id: string; name: string; currentStock: number; reorderLevel: number }>
  > {
    const rows = await this.prisma.medicine.findMany({
      where: { pharmacyId, branchId, isActive: true, currentStock: 0 },
      select: { id: true, genericName: true, brandName: true, currentStock: true, reorderLevel: true },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.brandName ?? r.genericName,
      currentStock: r.currentStock,
      reorderLevel: r.reorderLevel,
    }));
  }

  async getExpiringBatches(
    pharmacyId: string,
    branchId: string,
    thresholdDays: number,
  ): Promise<Array<{ id: string; medicineId: string; batchNumber: string; expiryDate: Date; currentQuantity: number }>> {
    const now = new Date();
    const threshold = new Date(now.getTime() + thresholdDays * 24 * 60 * 60 * 1000);
    return this.prisma.medicineBatch.findMany({
      where: { pharmacyId, branchId, expiryDate: { gte: now, lte: threshold }, currentQuantity: { gt: 0 }, isRecalled: false },
      orderBy: { expiryDate: 'asc' },
    });
  }

  async getAcknowledgedReferenceIds(
    pharmacyId: string,
    branchId: string,
    alertType: string,
  ): Promise<Set<string>> {
    const rows = await this.prisma.dashboardAlertAcknowledgement.findMany({
      where: { pharmacyId, branchId, alertType },
      select: { referenceId: true },
    });
    return new Set(rows.map((r) => r.referenceId));
  }

  async createAcknowledgement(entry: {
    pharmacyId: string;
    branchId: string;
    alertType: string;
    referenceId: string;
    acknowledgedBy: string;
    note?: string;
  }): Promise<void> {
    await this.prisma.dashboardAlertAcknowledgement.create({ data: entry });
  }

  async getPendingPurchaseOrders(pharmacyId: string, branchId: string): Promise<
    Array<{ id: string; poNumber: string; supplierId: string; status: string; grandTotal: Prisma.Decimal; createdAt: Date; supplier: { name: string } | null }>
  > {
    return this.prisma.purchaseOrder.findMany({
      where: { pharmacyId, branchId, status: { in: ['PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { supplier: { select: { name: true } } },
    });
  }

  async getCashSummary(pharmacyId: string, branchId: string, from: Date, to: Date, cashierId?: string) {
    // Payment method now lives on SalePayment (a sale can be split across methods),
    // so group payments by method filtered through their parent Sale.
    const rows = await this.prisma.salePayment.groupBy({
      by: ['method'],
      where: {
        sale: {
          pharmacyId,
          branchId,
          status: 'COMPLETED',
          saleDate: { gte: from, lte: to },
          ...(cashierId ? { cashierId } : {}),
        },
      },
      _sum: { amount: true },
    });
    return rows.map((r) => ({ paymentMethod: r.method, _sum: { totalAmount: r._sum.amount } }));
  }

  async getWidgetPreferences(userId: string, branchId: string | null): Promise<
    Array<{ widgetKey: string; isVisible: boolean; position: number; config: Prisma.JsonValue }>
  > {
    return this.prisma.dashboardWidgetPreference.findMany({
      where: { userId, branchId },
      orderBy: { position: 'asc' },
    });
  }

  /**
   * `branchId` is nullable, so it can't be used inside a compound `@@unique`
   * lookup type-safely (Prisma requires a non-null value there) — find-then-
   * write instead of `upsert` avoids that friction.
   */
  async upsertWidgetPreference(entry: {
    userId: string;
    pharmacyId: string;
    branchId: string | null;
    widgetKey: string;
    isVisible: boolean;
    position: number;
    config?: Record<string, unknown>;
  }): Promise<void> {
    const existing = await this.prisma.dashboardWidgetPreference.findFirst({
      where: { userId: entry.userId, widgetKey: entry.widgetKey, branchId: entry.branchId },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.dashboardWidgetPreference.update({
        where: { id: existing.id },
        data: { isVisible: entry.isVisible, position: entry.position, config: entry.config as Prisma.InputJsonValue },
      });
    } else {
      await this.prisma.dashboardWidgetPreference.create({
        data: { ...entry, config: entry.config as Prisma.InputJsonValue },
      });
    }
  }
}
