import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { SettingsService } from '../../settings/settings.service';
import { ResolvedRange } from '../date-range.util';
import { ReportFilters, TabularReport } from '../interfaces/report-filters.interface';

const dec = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : typeof v === 'number' ? v : v.toNumber());
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Inventory & operational reports (spec §2.2). Read-only over Module 5/6 data. */
@Injectable()
export class InventoryReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  private branches(user: AuthenticatedUser, branchId?: string): string[] {
    if (branchId) return user.accessibleBranchIds.includes(branchId) ? [branchId] : [];
    return user.accessibleBranchIds;
  }

  /** Current inventory value by category, from live batch quantities × receipt cost. */
  async stockValuation(user: AuthenticatedUser, branchId?: string): Promise<TabularReport> {
    const branches = this.branches(user, branchId);
    if (branches.length === 0) return { columns: VAL_COLS, rows: [] };
    const rows = await this.prisma.$queryRaw<Array<{ categoryId: string | null; categoryName: string | null; units: bigint; value: Prisma.Decimal }>>(Prisma.sql`
      SELECT c.id AS "categoryId", c.name AS "categoryName",
             SUM(b."currentQuantity") AS units, SUM(b."currentQuantity" * b."unitCostAtReceipt") AS value
      FROM "MedicineBatch" b JOIN "Medicine" m ON m.id = b."medicineId" LEFT JOIN "Category" c ON c.id = m."categoryId"
      WHERE b."pharmacyId" = ${user.pharmacyId} AND b."branchId" IN (${Prisma.join(branches)}) AND b."currentQuantity" > 0
      GROUP BY c.id, c.name ORDER BY value DESC
    `);
    const mapped = rows.map((r) => ({ category: r.categoryName ?? 'Uncategorized', units: Number(r.units), value: round2(dec(r.value)) }));
    return { columns: VAL_COLS, rows: mapped, summary: { totalValue: round2(mapped.reduce((s, r) => s + r.value, 0)), totalUnits: mapped.reduce((s, r) => s + r.units, 0) } };
  }

  async stockMovement(user: AuthenticatedUser, range: ResolvedRange, filters: ReportFilters): Promise<TabularReport> {
    const branches = this.branches(user, filters.branchId);
    const entries = await this.prisma.stockLedgerEntry.findMany({
      where: { pharmacyId: user.pharmacyId, branchId: { in: branches }, createdAt: { gte: range.from, lte: range.to }, ...(filters.medicineId ? { medicineId: filters.medicineId } : {}) },
      orderBy: { createdAt: 'asc' }, take: 20000,
    });
    const medIds = [...new Set(entries.map((e) => e.medicineId))];
    const meds = medIds.length ? await this.prisma.medicine.findMany({ where: { id: { in: medIds } }, select: { id: true, genericName: true, brandName: true } }) : [];
    const nameOf = new Map(meds.map((m) => [m.id, m.brandName ?? m.genericName]));
    return {
      columns: [
        { key: 'date', label: 'Date' }, { key: 'medicine', label: 'Medicine' }, { key: 'direction', label: 'Dir' },
        { key: 'quantity', label: 'Qty', numeric: true }, { key: 'reason', label: 'Reason' }, { key: 'source', label: 'Source' }, { key: 'balanceAfter', label: 'Balance', numeric: true },
      ],
      rows: entries.map((e) => ({ date: e.createdAt.toISOString().slice(0, 10), medicine: nameOf.get(e.medicineId) ?? e.medicineId, direction: e.direction, quantity: e.quantity, reason: e.reasonCode, source: e.referenceModule, balanceAfter: e.balanceAfter })),
      meta: { dateFrom: range.from.toISOString(), dateTo: range.to.toISOString() },
    };
  }

  async expiringStock(user: AuthenticatedUser, branchId?: string): Promise<TabularReport> {
    const branches = this.branches(user, branchId);
    const tiers = (await this.settings.get<{ red: number; orange: number; yellow: number }>('dashboard.alerts.expiryTiers', { pharmacyId: user.pharmacyId })) ?? { red: 30, orange: 90, yellow: 180 };
    const now = new Date();
    const horizon = new Date(now.getTime() + tiers.yellow * 86_400_000);
    const batches = await this.prisma.medicineBatch.findMany({
      where: { pharmacyId: user.pharmacyId, branchId: { in: branches }, currentQuantity: { gt: 0 }, isRecalled: false, expiryDate: { lte: horizon } },
      orderBy: { expiryDate: 'asc' }, take: 10000,
    });
    const medIds = [...new Set(batches.map((b) => b.medicineId))];
    const meds = medIds.length ? await this.prisma.medicine.findMany({ where: { id: { in: medIds } }, select: { id: true, genericName: true, brandName: true } }) : [];
    const nameOf = new Map(meds.map((m) => [m.id, m.brandName ?? m.genericName]));
    const rows = batches.map((b) => {
      const days = Math.ceil((b.expiryDate.getTime() - now.getTime()) / 86_400_000);
      const tier = days < 0 ? 'EXPIRED' : days <= tiers.red ? 'RED' : days <= tiers.orange ? 'ORANGE' : 'YELLOW';
      return { medicine: nameOf.get(b.medicineId) ?? b.medicineId, batch: b.batchNumber, expiryDate: b.expiryDate.toISOString().slice(0, 10), daysToExpiry: days, quantity: b.currentQuantity, tier, value: round2(b.currentQuantity * dec(b.unitCostAtReceipt)) };
    });
    return {
      columns: [
        { key: 'medicine', label: 'Medicine' }, { key: 'batch', label: 'Batch' }, { key: 'expiryDate', label: 'Expiry' },
        { key: 'daysToExpiry', label: 'Days', numeric: true }, { key: 'quantity', label: 'Qty', numeric: true }, { key: 'tier', label: 'Tier' }, { key: 'value', label: 'Value at cost', numeric: true },
      ],
      rows,
      summary: { batches: rows.length, valueAtRisk: round2(rows.reduce((s, r) => s + r.value, 0)) },
    };
  }

  async batchTraceability(user: AuthenticatedUser, batchId: string): Promise<TabularReport> {
    const batch = await this.prisma.medicineBatch.findFirst({ where: { id: batchId, pharmacyId: user.pharmacyId } });
    if (!batch) throw new NotFoundException({ errorCode: 'BATCH_NOT_FOUND', message: 'Batch not found.' });
    const [sold, returned, writeOffs] = await Promise.all([
      this.prisma.saleItem.findMany({ where: { batchId }, select: { quantity: true, sale: { select: { saleNumber: true, saleDate: true } } } }),
      this.prisma.salesReturnItem.findMany({ where: { batchId }, select: { quantityReturned: true, salesReturn: { select: { returnNumber: true, returnDate: true } } } }),
      this.prisma.batchWriteOff.findMany({ where: { batchId }, select: { quantityWrittenOff: true, disposalMethod: true, writtenOffAt: true } }),
    ]);
    const rows: Array<Record<string, string | number | null>> = [
      { event: 'RECEIVED', reference: batch.sourceGrnId ?? '—', date: batch.createdAt.toISOString().slice(0, 10), quantity: batch.receivedQuantity, detail: `Batch ${batch.batchNumber}` },
      ...sold.map((s) => ({ event: 'SOLD', reference: s.sale.saleNumber, date: s.sale.saleDate.toISOString().slice(0, 10), quantity: -s.quantity, detail: '' })),
      ...returned.map((r) => ({ event: 'RETURNED', reference: r.salesReturn.returnNumber, date: r.salesReturn.returnDate.toISOString().slice(0, 10), quantity: r.quantityReturned, detail: '' })),
      ...writeOffs.map((w) => ({ event: 'WRITTEN_OFF', reference: '—', date: w.writtenOffAt.toISOString().slice(0, 10), quantity: -w.quantityWrittenOff, detail: w.disposalMethod })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return {
      columns: [{ key: 'event', label: 'Event' }, { key: 'reference', label: 'Reference' }, { key: 'date', label: 'Date' }, { key: 'quantity', label: 'Qty', numeric: true }, { key: 'detail', label: 'Detail' }],
      rows,
      summary: { batchNumber: batch.batchNumber, received: batch.receivedQuantity, currentQuantity: batch.currentQuantity, expiryDate: batch.expiryDate.toISOString().slice(0, 10) },
    };
  }

  async reorderLowStock(user: AuthenticatedUser, branchId?: string): Promise<TabularReport> {
    const branches = this.branches(user, branchId);
    if (branches.length === 0) return { columns: REORDER_COLS, rows: [] };
    const rows = await this.prisma.$queryRaw<Array<{ name: string; currentStock: number; reorderLevel: number; branchId: string }>>(Prisma.sql`
      SELECT COALESCE("brandName", "genericName") AS name, "currentStock", "reorderLevel", "branchId"
      FROM "Medicine"
      WHERE "pharmacyId" = ${user.pharmacyId} AND "branchId" IN (${Prisma.join(branches)}) AND "isActive" = true AND "currentStock" <= "reorderLevel"
      ORDER BY "currentStock" ASC
    `);
    return {
      columns: REORDER_COLS,
      rows: rows.map((r) => ({ medicine: r.name, currentStock: r.currentStock, reorderLevel: r.reorderLevel, shortfall: Math.max(0, r.reorderLevel - r.currentStock) })),
      summary: { itemsBelowReorder: rows.length },
    };
  }
}

const VAL_COLS = [{ key: 'category', label: 'Category' }, { key: 'units', label: 'Units', numeric: true }, { key: 'value', label: 'Value at cost', numeric: true }];
const REORDER_COLS = [{ key: 'medicine', label: 'Medicine' }, { key: 'currentStock', label: 'On hand', numeric: true }, { key: 'reorderLevel', label: 'Reorder level', numeric: true }, { key: 'shortfall', label: 'Shortfall', numeric: true }];
