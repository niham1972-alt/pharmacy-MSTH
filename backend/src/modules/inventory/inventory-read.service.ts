import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { QueryInventoryDto } from './dto/inventory.dto';

function dec(v: Prisma.Decimal | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : v.toNumber();
}

const canSeeCost = (role: string) => role !== 'cashier';

/**
 * Read-side queries for the Inventory HTTP endpoints. `currentStock` is read
 * from `Medicine` (the mirror kept in lock-step by InventoryService); the ledger
 * endpoint reads the forensic `StockLedgerEntry` table directly.
 */
@Injectable()
export class InventoryReadService {
  constructor(private readonly prisma: PrismaService) {}

  private branch(user: AuthenticatedUser, requested?: string): string {
    const branchId = requested ?? user.branchId;
    if (!user.accessibleBranchIds.includes(branchId)) throw new ForbiddenException({ errorCode: 'BRANCH_ACCESS_DENIED', message: `No access to branch ${branchId}` });
    return branchId;
  }

  async list(user: AuthenticatedUser, q: QueryInventoryDto) {
    const branchId = this.branch(user, q.branchId);
    const where: Prisma.MedicineWhereInput = { pharmacyId: user.pharmacyId, OR: [{ branchId }, { isGlobalAcrossBranches: true }], isActive: true };
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.search) where.AND = [{ OR: [{ genericName: { contains: q.search, mode: 'insensitive' } }, { brandName: { contains: q.search, mode: 'insensitive' } }, { sku: { contains: q.search, mode: 'insensitive' } }] }];
    if (q.stockStatus === 'out') where.currentStock = 0;
    if (q.stockStatus === 'in_stock') where.currentStock = { gt: 0 };

    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const orderBy: Prisma.MedicineOrderByWithRelationInput = q.sortBy === 'stock' ? { currentStock: q.sortOrder ?? 'asc' } : q.sortBy === 'updatedAt' ? { updatedAt: q.sortOrder ?? 'desc' } : { genericName: q.sortOrder ?? 'asc' };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.medicine.count({ where }),
      this.prisma.medicine.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit, include: { category: { select: { name: true } } } }),
    ]);

    let data = rows.map((m) => this.serializeRow(m, user));
    if (q.stockStatus === 'low') data = data.filter((r) => r.stockStatus === 'low');
    return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), data };
  }

  private serializeRow(m: Prisma.MedicineGetPayload<{ include: { category: { select: { name: true } } } }>, user: AuthenticatedUser) {
    const stockStatus = m.currentStock <= 0 ? 'out' : m.currentStock <= m.reorderLevel ? 'low' : 'in_stock';
    const base: Record<string, unknown> = {
      medicineId: m.id,
      name: m.brandName ?? m.genericName,
      sku: m.sku,
      category: m.category?.name ?? null,
      currentStock: m.currentStock,
      reorderLevel: m.reorderLevel,
      stockStatus,
      lastMovementAt: m.updatedAt.toISOString(),
    };
    if (canSeeCost(user.role)) {
      base.unitCost = dec(m.costPrice);
      base.stockValue = Math.round(m.currentStock * dec(m.costPrice) * 100) / 100;
    }
    return base as { medicineId: string; stockStatus: string } & Record<string, unknown>;
  }

  async detail(user: AuthenticatedUser, medicineId: string, branchId?: string) {
    const scope = this.branch(user, branchId);
    const m = await this.prisma.medicine.findFirst({ where: { id: medicineId, pharmacyId: user.pharmacyId }, include: { category: { select: { name: true } } } });
    if (!m) throw new NotFoundException({ errorCode: 'MEDICINE_NOT_FOUND', message: 'Medicine not found' });
    const batches = await this.prisma.medicineBatch.findMany({ where: { pharmacyId: user.pharmacyId, branchId: scope, medicineId, currentQuantity: { gt: 0 } }, orderBy: { expiryDate: 'asc' } });

    const base: Record<string, unknown> = {
      medicineId: m.id,
      name: m.brandName ?? m.genericName,
      sku: m.sku,
      category: m.category?.name ?? null,
      currentStock: m.currentStock,
      reorderLevel: m.reorderLevel,
      reorderQuantity: m.reorderQuantity,
      stockStatus: m.currentStock <= 0 ? 'out' : m.currentStock <= m.reorderLevel ? 'low' : 'in_stock',
      batches: batches.map((b) => ({ id: b.id, batchNumber: b.batchNumber, quantity: b.currentQuantity, expiryDate: b.expiryDate.toISOString(), status: b.status, isRecalled: b.isRecalled })),
    };
    if (canSeeCost(user.role)) {
      base.unitCost = dec(m.costPrice);
      base.stockValue = Math.round(m.currentStock * dec(m.costPrice) * 100) / 100;
    }
    return base;
  }

  async ledger(user: AuthenticatedUser, medicineId: string, page = 1, limit = 30, branchId?: string) {
    const scope = this.branch(user, branchId);
    const where = { pharmacyId: user.pharmacyId, branchId: scope, medicineId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.stockLedgerEntry.count({ where }),
      this.prisma.stockLedgerEntry.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    return {
      page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)),
      data: rows.map((e) => ({ id: e.id, direction: e.direction, quantity: e.quantity, reasonCode: e.reasonCode, referenceModule: e.referenceModule, referenceId: e.referenceId, balanceAfter: e.balanceAfter, performedBy: e.performedBy, notes: e.notes, createdAt: e.createdAt.toISOString() })),
    };
  }

  async summary(user: AuthenticatedUser, branchId?: string) {
    const scope = this.branch(user, branchId);
    const meds = await this.prisma.medicine.findMany({ where: { pharmacyId: user.pharmacyId, OR: [{ branchId: scope }, { isGlobalAcrossBranches: true }], isActive: true }, select: { currentStock: true, reorderLevel: true, costPrice: true } });
    let totalValue = 0;
    let low = 0;
    let out = 0;
    for (const m of meds) {
      totalValue += m.currentStock * dec(m.costPrice);
      if (m.currentStock <= 0) out++;
      else if (m.currentStock <= m.reorderLevel) low++;
    }
    return { totalSkus: meds.length, totalStockValue: Math.round(totalValue * 100) / 100, lowStockCount: low, outOfStockCount: out };
  }

  async reorderSuggestions(user: AuthenticatedUser, branchId?: string) {
    const scope = this.branch(user, branchId);
    const rows = await this.prisma.$queryRaw<Array<{ id: string; name: string; sku: string; currentStock: number; reorderLevel: number; reorderQuantity: number }>>(
      Prisma.sql`
        SELECT id, COALESCE("brandName", "genericName") AS name, sku, "currentStock", "reorderLevel", "reorderQuantity"
        FROM "Medicine"
        WHERE "pharmacyId" = ${user.pharmacyId} AND ("branchId" = ${scope} OR "isGlobalAcrossBranches" = true) AND "isActive" = true
          AND "currentStock" <= "reorderLevel"
        ORDER BY "currentStock" ASC
      `,
    );
    return rows.map((r) => ({ medicineId: r.id, name: r.name, sku: r.sku, currentStock: r.currentStock, reorderLevel: r.reorderLevel, suggestedQuantity: r.reorderQuantity, stockStatus: r.currentStock <= 0 ? 'out' : 'low' }));
  }

  async valuation(user: AuthenticatedUser, branchId?: string) {
    const scope = this.branch(user, branchId);
    const meds = await this.prisma.medicine.findMany({ where: { pharmacyId: user.pharmacyId, OR: [{ branchId: scope }, { isGlobalAcrossBranches: true }], isActive: true }, include: { category: { select: { name: true } } } });
    const byCategory: Record<string, { quantity: number; value: number }> = {};
    let grandValue = 0;
    for (const m of meds) {
      const val = m.currentStock * dec(m.costPrice);
      grandValue += val;
      const cat = m.category?.name ?? 'Uncategorized';
      byCategory[cat] = byCategory[cat] ?? { quantity: 0, value: 0 };
      byCategory[cat].quantity += m.currentStock;
      byCategory[cat].value += val;
    }
    return {
      grandTotalValue: Math.round(grandValue * 100) / 100,
      byCategory: Object.entries(byCategory).map(([category, v]) => ({ category, quantity: v.quantity, value: Math.round(v.value * 100) / 100 })),
    };
  }
}
