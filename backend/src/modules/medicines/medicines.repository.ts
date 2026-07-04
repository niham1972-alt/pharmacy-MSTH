import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryMedicinesDto } from './dto/query-medicines.dto';

/**
 * All Prisma access for the Medicines module. Search uses ILIKE for
 * typo-tolerant-ish contains matching; production should add a `pg_trgm` GIN
 * index on genericName/brandName (spec §18) — swapping the WHERE here for a
 * `similarity()` predicate is then a one-line change.
 */
@Injectable()
export class MedicinesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly detailInclude = {
    manufacturer: true,
    category: true,
    dosageForm: true,
    baseUnit: true,
    purchaseUnit: true,
    saleUnit: true,
    barcodes: true,
    unitConversions: true,
  } satisfies Prisma.MedicineInclude;

  async list(pharmacyId: string, branchId: string, q: QueryMedicinesDto) {
    const where = this.buildWhere(pharmacyId, branchId, q);
    const orderBy = this.buildOrderBy(q);
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.medicine.count({ where }),
      this.prisma.medicine.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          manufacturer: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          dosageForm: { select: { id: true, name: true } },
          barcodes: { where: { isPrimary: true }, take: 1 },
        },
      }),
    ]);

    return { total, rows, page, limit };
  }

  private buildWhere(pharmacyId: string, branchId: string, q: QueryMedicinesDto): Prisma.MedicineWhereInput {
    const where: Prisma.MedicineWhereInput = {
      pharmacyId,
      // Global-catalog medicines (branchId null) are visible to every branch.
      OR: [{ branchId }, { isGlobalAcrossBranches: true }],
    };

    if (q.search) {
      const s = q.search.trim();
      where.AND = [
        {
          OR: [
            { genericName: { contains: s, mode: 'insensitive' } },
            { brandName: { contains: s, mode: 'insensitive' } },
            { sku: { contains: s, mode: 'insensitive' } },
            { barcodes: { some: { barcode: { contains: s, mode: 'insensitive' } } } },
          ],
        },
      ];
    }
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.manufacturerId) where.manufacturerId = q.manufacturerId;
    if (q.dosageFormId) where.dosageFormId = q.dosageFormId;
    if (q.status) where.status = q.status;
    if (q.prescriptionRequired !== undefined) where.prescriptionRequired = q.prescriptionRequired === 'true';
    if (q.priceMin !== undefined || q.priceMax !== undefined) {
      where.sellingPrice = {
        ...(q.priceMin !== undefined ? { gte: q.priceMin } : {}),
        ...(q.priceMax !== undefined ? { lte: q.priceMax } : {}),
      };
    }
    if (q.stockStatus === 'out') where.currentStock = 0;
    if (q.stockStatus === 'in_stock') where.currentStock = { gt: 0 };
    // "low" (currentStock <= reorderLevel) can't be expressed column-to-column
    // in the Prisma builder; the service post-filters when stockStatus === 'low'.
    return where;
  }

  private buildOrderBy(q: QueryMedicinesDto): Prisma.MedicineOrderByWithRelationInput {
    const dir = q.sortOrder ?? 'desc';
    switch (q.sortBy) {
      case 'name':
        return { genericName: dir };
      case 'price':
        return { sellingPrice: dir };
      case 'stock':
        return { currentStock: dir };
      case 'updatedAt':
        return { updatedAt: dir };
      default:
        return { createdAt: dir };
    }
  }

  findById(pharmacyId: string, id: string) {
    return this.prisma.medicine.findFirst({
      where: { id, pharmacyId },
      include: this.detailInclude,
    });
  }

  findByIdRaw(pharmacyId: string, id: string) {
    return this.prisma.medicine.findFirst({ where: { id, pharmacyId } });
  }

  async search(pharmacyId: string, branchId: string, term: string, limit: number) {
    const s = term.trim();
    return this.prisma.medicine.findMany({
      where: {
        pharmacyId,
        isActive: true,
        OR: [{ branchId }, { isGlobalAcrossBranches: true }],
        AND: [
          {
            OR: [
              { genericName: { contains: s, mode: 'insensitive' } },
              { brandName: { contains: s, mode: 'insensitive' } },
              { sku: { contains: s, mode: 'insensitive' } },
              { barcodes: { some: { barcode: { contains: s, mode: 'insensitive' } } } },
            ],
          },
        ],
      },
      take: limit,
      select: {
        id: true,
        genericName: true,
        brandName: true,
        sku: true,
        sellingPrice: true,
        costPrice: true,
        taxRatePercent: true,
        taxInclusive: true,
        imageUrl: true,
        currentStock: true,
        reorderLevel: true,
        prescriptionRequired: true,
        controlledSubstanceSchedule: true,
        status: true,
        barcodes: { where: { isPrimary: true }, take: 1, select: { barcode: true } },
      },
    });
  }

  create(data: Prisma.MedicineCreateInput) {
    return this.prisma.medicine.create({ data, include: this.detailInclude });
  }

  /** Atomic update + PriceHistory rows for any changed price (spec §8/§11). */
  async updateWithPriceHistory(
    id: string,
    pharmacyId: string,
    data: Prisma.MedicineUpdateInput,
    priceEntries: Prisma.PriceHistoryCreateManyInput[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.medicine.update({ where: { id }, data, include: this.detailInclude });
      if (priceEntries.length) {
        await tx.priceHistory.createMany({ data: priceEntries });
      }
      return updated;
    });
  }

  changeStatus(id: string, status: Prisma.MedicineUpdateInput['status'], isActive: boolean, updatedBy: string) {
    return this.prisma.medicine.update({ where: { id }, data: { status, isActive, updatedBy } });
  }

  getPriceHistory(pharmacyId: string, medicineId: string) {
    return this.prisma.priceHistory.findMany({
      where: { pharmacyId, medicineId },
      orderBy: { effectiveAt: 'desc' },
    });
  }

  /** Duplicate = same generic + strength + manufacturer + dosage form (spec §2.1/§21). */
  findDuplicates(pharmacyId: string, genericName: string, strength: string | undefined, manufacturerId: string, dosageFormId: string) {
    return this.prisma.medicine.findMany({
      where: {
        pharmacyId,
        genericName: { equals: genericName, mode: 'insensitive' },
        strength: strength ?? null,
        manufacturerId,
        dosageFormId,
      },
      select: { id: true, genericName: true, brandName: true, strength: true, sku: true },
    });
  }

  findBarcodeConflict(pharmacyId: string, barcode: string) {
    return this.prisma.medicineBarcode.findFirst({ where: { pharmacyId, barcode } });
  }

  addBarcode(data: Prisma.MedicineBarcodeUncheckedCreateInput) {
    return this.prisma.medicineBarcode.create({ data });
  }

  removeBarcode(medicineId: string, barcodeId: string) {
    return this.prisma.medicineBarcode.deleteMany({ where: { id: barcodeId, medicineId } });
  }

  /** Blocks hard-delete when transactional history exists (spec §2.1/§11). */
  async hasTransactionalHistory(medicineId: string): Promise<boolean> {
    const [saleItems, batches] = await Promise.all([
      this.prisma.saleItem.count({ where: { medicineId } }),
      this.prisma.medicineBatch.count({ where: { medicineId } }),
    ]);
    return saleItems > 0 || batches > 0;
  }

  hardDelete(id: string) {
    return this.prisma.medicine.delete({ where: { id } });
  }

  /** Next SKU sequence for auto-generation (`MED-{n}`). */
  async nextSkuSequence(pharmacyId: string): Promise<number> {
    const count = await this.prisma.medicine.count({ where: { pharmacyId } });
    return count + 1;
  }

  countByLookup(field: 'manufacturerId' | 'categoryId' | 'dosageFormId', id: string) {
    return this.prisma.medicine.count({ where: { [field]: id } });
  }
}
