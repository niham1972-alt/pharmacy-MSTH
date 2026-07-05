import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { MedicinesRepository } from './medicines.repository';
import { MedicineEventsEmitter } from './events/medicine-events.emitter';
import { CreateMedicineDto, UpdateMedicineDto } from './dto/create-medicine.dto';
import { QueryMedicinesDto, SearchMedicinesDto } from './dto/query-medicines.dto';
import { AddBarcodeDto, ChangeStatusDto, CheckDuplicateDto } from './dto/misc.dto';
import { MedicineSearchResult, PaginatedResult } from './interfaces/medicine.interface';

function dec(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : value.toNumber();
}

type MedicineWithRelations = Prisma.MedicineGetPayload<{
  include: {
    manufacturer: true;
    category: true;
    dosageForm: true;
    baseUnit: true;
    purchaseUnit: true;
    saleUnit: true;
    barcodes: true;
    unitConversions: true;
  };
}>;

@Injectable()
export class MedicinesService {
  constructor(
    private readonly repo: MedicinesRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: MedicineEventsEmitter,
  ) {}

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  async list(user: AuthenticatedUser, dto: QueryMedicinesDto): Promise<PaginatedResult<Record<string, unknown>>> {
    const branchId = this.resolveBranch(user, dto.branchId);
    const { total, rows, page, limit } = await this.repo.list(user.pharmacyId, branchId, dto);

    let data = rows.map((m) => this.serializeListRow(m, user));
    // "low stock" needs a column-to-column comparison the DB builder can't do.
    if (dto.stockStatus === 'low') {
      data = data.filter((m) => m.stockStatus === 'low');
    }

    return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), data };
  }

  async getById(user: AuthenticatedUser, id: string): Promise<Record<string, unknown>> {
    const medicine = await this.repo.findById(user.pharmacyId, id);
    if (!medicine) throw new NotFoundException({ errorCode: 'MEDICINE_NOT_FOUND', message: 'Medicine not found' });
    return this.serializeDetail(medicine, user);
  }

  async search(user: AuthenticatedUser, dto: SearchMedicinesDto): Promise<MedicineSearchResult[]> {
    const branchId = this.resolveBranch(user, dto.branchId);
    const rows = await this.repo.search(user.pharmacyId, branchId, dto.q ?? '', dto.limit ?? 20);
    return rows.map((m) => {
      const result: MedicineSearchResult = {
        id: m.id,
        name: m.brandName ?? m.genericName,
        sku: m.sku,
        sellingPrice: dec(m.sellingPrice),
        taxRatePercent: dec(m.taxRatePercent),
        primaryBarcode: m.barcodes[0]?.barcode ?? null,
        imageUrl: m.imageUrl,
        currentStock: m.currentStock,
        stockStatus: this.stockStatusOf(m.currentStock, m.reorderLevel),
        taxInclusive: m.taxInclusive,
        prescriptionRequired: m.prescriptionRequired,
        controlled: !!m.controlledSubstanceSchedule,
        discontinued: m.status === 'DISCONTINUED',
      };
      if (this.canSeeCost(user.role)) result.costPrice = dec(m.costPrice);
      return result;
    });
  }

  async getPriceHistory(user: AuthenticatedUser, id: string) {
    const medicine = await this.repo.findByIdRaw(user.pharmacyId, id);
    if (!medicine) throw new NotFoundException({ errorCode: 'MEDICINE_NOT_FOUND', message: 'Medicine not found' });
    const rows = await this.repo.getPriceHistory(user.pharmacyId, id);
    return rows.map((r) => ({
      id: r.id,
      priceType: r.priceType,
      oldValue: dec(r.oldValue),
      newValue: dec(r.newValue),
      changedBy: r.changedBy,
      effectiveAt: r.effectiveAt.toISOString(),
      reason: r.reason,
    }));
  }

  async checkDuplicate(user: AuthenticatedUser, dto: CheckDuplicateDto) {
    const matches = await this.repo.findDuplicates(user.pharmacyId, dto.genericName, dto.strength, dto.manufacturerId, dto.dosageFormId);
    return { isDuplicate: matches.length > 0, matches };
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  async create(user: AuthenticatedUser, dto: CreateMedicineDto): Promise<Record<string, unknown>> {
    await this.validateLookups(user.pharmacyId, dto);
    const prescriptionRequired = this.enforceControlledRule(dto.controlledSubstanceSchedule, dto.prescriptionRequired);

    const cost = dto.costPrice ?? 0;
    const selling = dto.sellingPrice ?? 0;
    if (selling > 0 && cost > 0 && selling < cost && !dto.confirmNegativeMargin) {
      throw new BadRequestException({ errorCode: 'NEGATIVE_MARGIN', message: 'Selling price is below cost price. Confirm to proceed.' });
    }

    if (!dto.confirmDuplicate) {
      const dupes = await this.repo.findDuplicates(user.pharmacyId, dto.genericName, dto.strength, dto.manufacturerId, dto.dosageFormId);
      if (dupes.length) {
        throw new ConflictException({ errorCode: 'DUPLICATE_MEDICINE', message: 'A similar medicine already exists. Confirm to proceed.', data: dupes });
      }
    }

    const sku = dto.sku?.trim() || `MED-${await this.repo.nextSkuSequence(user.pharmacyId)}`;
    await this.assertSkuFree(user.pharmacyId, sku);
    await this.assertBarcodesFree(user.pharmacyId, dto.barcodes ?? []);

    const branchId = dto.isGlobalAcrossBranches ? null : this.resolveBranch(user, dto.branchId);

    const priceHistorySeed: Prisma.PriceHistoryCreateWithoutMedicineInput[] = [];
    for (const [type, value] of [
      ['COST', cost],
      ['MRP', dto.mrp ?? 0],
      ['SELLING', selling],
    ] as const) {
      if (value > 0) {
        priceHistorySeed.push({ pharmacyId: user.pharmacyId, priceType: type, oldValue: 0, newValue: value, changedBy: user.userId, reason: 'Initial price' });
      }
    }

    const created = await this.repo.create({
      pharmacyId: user.pharmacyId,
      branchId,
      isGlobalAcrossBranches: dto.isGlobalAcrossBranches ?? false,
      sku,
      genericName: dto.genericName,
      brandName: dto.brandName,
      manufacturer: { connect: { id: dto.manufacturerId } },
      category: { connect: { id: dto.categoryId } },
      subCategoryId: dto.subCategoryId,
      dosageForm: { connect: { id: dto.dosageFormId } },
      strength: dto.strength,
      routeOfAdministration: dto.routeOfAdministration,
      therapeuticClass: dto.therapeuticClass,
      storageCondition: dto.storageCondition,
      prescriptionRequired,
      controlledSubstanceSchedule: dto.controlledSubstanceSchedule,
      baseUnit: { connect: { id: dto.baseUnitId } },
      purchaseUnit: { connect: { id: dto.purchaseUnitId } },
      saleUnit: { connect: { id: dto.saleUnitId } },
      costPrice: cost,
      mrp: dto.mrp ?? 0,
      sellingPrice: selling,
      taxRatePercent: dto.taxRatePercent ?? 0,
      taxInclusive: dto.taxInclusive ?? true,
      discountEligible: dto.discountEligible ?? true,
      reorderLevel: dto.reorderLevel ?? 10,
      reorderQuantity: dto.reorderQuantity ?? 50,
      maxStockLevel: dto.maxStockLevel,
      currentStock: dto.currentStock ?? 0,
      imageUrl: dto.imageUrl,
      documentUrl: dto.documentUrl,
      createdBy: user.userId,
      barcodes: dto.barcodes?.length
        ? { create: dto.barcodes.map((barcode, i) => ({ pharmacyId: user.pharmacyId, barcode, isPrimary: i === 0 })) }
        : undefined,
      priceHistory: priceHistorySeed.length ? { create: priceHistorySeed } : undefined,
    });

    await this.audit.record({
      pharmacyId: user.pharmacyId,
      branchId: branchId ?? user.branchId,
      userId: user.userId,
      action: 'MEDICINE_CREATED',
      entityType: 'MEDICINE',
      entityId: created.id,
      metadata: { sku, genericName: dto.genericName },
    });
    this.events.created({ pharmacyId: user.pharmacyId, branchId, medicineId: created.id, actorId: user.userId });

    return this.serializeDetail(created, user);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateMedicineDto): Promise<Record<string, unknown>> {
    const existing = await this.repo.findByIdRaw(user.pharmacyId, id);
    if (!existing) throw new NotFoundException({ errorCode: 'MEDICINE_NOT_FOUND', message: 'Medicine not found' });

    if (dto.expectedUpdatedAt && new Date(dto.expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()) {
      throw new ConflictException({ errorCode: 'STALE_RECORD', message: 'This record was changed since you loaded it. Reload and try again.' });
    }

    await this.validateLookups(user.pharmacyId, dto);

    const controlled = dto.controlledSubstanceSchedule !== undefined ? dto.controlledSubstanceSchedule : existing.controlledSubstanceSchedule ?? undefined;
    const prescriptionRequired = this.enforceControlledRule(controlled, dto.prescriptionRequired ?? existing.prescriptionRequired);

    const newCost = dto.costPrice ?? dec(existing.costPrice);
    const newSelling = dto.sellingPrice ?? dec(existing.sellingPrice);
    if (newSelling > 0 && newCost > 0 && newSelling < newCost && !dto.confirmNegativeMargin) {
      throw new BadRequestException({ errorCode: 'NEGATIVE_MARGIN', message: 'Selling price is below cost price. Confirm to proceed.' });
    }

    if (dto.sku && dto.sku !== existing.sku) await this.assertSkuFree(user.pharmacyId, dto.sku);

    // Detect price changes for immutable PriceHistory (spec §11).
    const priceEntries: Prisma.PriceHistoryCreateManyInput[] = [];
    const priceTypes: string[] = [];
    for (const [field, type] of [
      ['costPrice', 'COST'],
      ['mrp', 'MRP'],
      ['sellingPrice', 'SELLING'],
    ] as const) {
      const incoming = dto[field];
      if (incoming !== undefined && dec(existing[field]) !== incoming) {
        priceEntries.push({
          medicineId: id,
          pharmacyId: user.pharmacyId,
          priceType: type,
          oldValue: dec(existing[field]),
          newValue: incoming,
          changedBy: user.userId,
          reason: dto.priceChangeReason,
        });
        priceTypes.push(type);
      }
    }

    const data: Prisma.MedicineUpdateInput = {
      genericName: dto.genericName,
      brandName: dto.brandName,
      sku: dto.sku,
      strength: dto.strength,
      routeOfAdministration: dto.routeOfAdministration,
      therapeuticClass: dto.therapeuticClass,
      storageCondition: dto.storageCondition,
      prescriptionRequired,
      controlledSubstanceSchedule: dto.controlledSubstanceSchedule,
      costPrice: dto.costPrice,
      mrp: dto.mrp,
      sellingPrice: dto.sellingPrice,
      taxRatePercent: dto.taxRatePercent,
      taxInclusive: dto.taxInclusive,
      discountEligible: dto.discountEligible,
      reorderLevel: dto.reorderLevel,
      reorderQuantity: dto.reorderQuantity,
      maxStockLevel: dto.maxStockLevel,
      currentStock: dto.currentStock,
      imageUrl: dto.imageUrl,
      documentUrl: dto.documentUrl,
      updatedBy: user.userId,
      ...(dto.manufacturerId ? { manufacturer: { connect: { id: dto.manufacturerId } } } : {}),
      ...(dto.categoryId ? { category: { connect: { id: dto.categoryId } } } : {}),
      ...(dto.subCategoryId !== undefined ? { subCategoryId: dto.subCategoryId } : {}),
      ...(dto.dosageFormId ? { dosageForm: { connect: { id: dto.dosageFormId } } } : {}),
      ...(dto.baseUnitId ? { baseUnit: { connect: { id: dto.baseUnitId } } } : {}),
      ...(dto.purchaseUnitId ? { purchaseUnit: { connect: { id: dto.purchaseUnitId } } } : {}),
      ...(dto.saleUnitId ? { saleUnit: { connect: { id: dto.saleUnitId } } } : {}),
    };

    const updated = await this.repo.updateWithPriceHistory(id, user.pharmacyId, data, priceEntries);

    await this.audit.record({
      pharmacyId: user.pharmacyId,
      branchId: updated.branchId ?? user.branchId,
      userId: user.userId,
      action: 'MEDICINE_UPDATED',
      entityType: 'MEDICINE',
      entityId: id,
      metadata: { changedPrices: priceTypes },
    });
    this.events.updated({ pharmacyId: user.pharmacyId, branchId: updated.branchId, medicineId: id, actorId: user.userId });
    if (priceTypes.length) {
      await this.audit.record({
        pharmacyId: user.pharmacyId,
        branchId: updated.branchId ?? user.branchId,
        userId: user.userId,
        action: 'MEDICINE_PRICE_CHANGED',
        entityType: 'MEDICINE',
        entityId: id,
        metadata: { priceTypes },
      });
      this.events.priceChanged({ pharmacyId: user.pharmacyId, branchId: updated.branchId, medicineId: id, actorId: user.userId, priceTypes });
    }

    return this.serializeDetail(updated, user);
  }

  async changeStatus(user: AuthenticatedUser, id: string, dto: ChangeStatusDto) {
    const existing = await this.repo.findByIdRaw(user.pharmacyId, id);
    if (!existing) throw new NotFoundException({ errorCode: 'MEDICINE_NOT_FOUND', message: 'Medicine not found' });

    // INACTIVE hides the product; DISCONTINUED keeps it sellable from existing stock.
    const isActive = dto.status !== 'INACTIVE';
    await this.repo.changeStatus(id, dto.status, isActive, user.userId);

    await this.audit.record({
      pharmacyId: user.pharmacyId,
      branchId: existing.branchId ?? user.branchId,
      userId: user.userId,
      action: 'MEDICINE_STATUS_CHANGED',
      entityType: 'MEDICINE',
      entityId: id,
      metadata: { from: existing.status, to: dto.status, reason: dto.reason },
    });
    this.events.statusChanged({ pharmacyId: user.pharmacyId, branchId: existing.branchId, medicineId: id, actorId: user.userId, status: dto.status });
    return { id, status: dto.status };
  }

  async archive(user: AuthenticatedUser, id: string) {
    const existing = await this.repo.findByIdRaw(user.pharmacyId, id);
    if (!existing) throw new NotFoundException({ errorCode: 'MEDICINE_NOT_FOUND', message: 'Medicine not found' });
    await this.repo.changeStatus(id, 'INACTIVE', false, user.userId);
    await this.audit.record({
      pharmacyId: user.pharmacyId,
      branchId: existing.branchId ?? user.branchId,
      userId: user.userId,
      action: 'MEDICINE_ARCHIVED',
      entityType: 'MEDICINE',
      entityId: id,
    });
    this.events.archived({ pharmacyId: user.pharmacyId, branchId: existing.branchId, medicineId: id, actorId: user.userId });
    return { id, archived: true };
  }

  async hardDelete(user: AuthenticatedUser, id: string) {
    const existing = await this.repo.findByIdRaw(user.pharmacyId, id);
    if (!existing) throw new NotFoundException({ errorCode: 'MEDICINE_NOT_FOUND', message: 'Medicine not found' });
    if (await this.repo.hasTransactionalHistory(id)) {
      throw new ConflictException({
        errorCode: 'HAS_TRANSACTIONAL_HISTORY',
        message: 'Cannot delete: this medicine has sales or batch history. Archive it instead.',
      });
    }
    await this.repo.hardDelete(id);
    await this.audit.record({
      pharmacyId: user.pharmacyId,
      branchId: existing.branchId ?? user.branchId,
      userId: user.userId,
      action: 'MEDICINE_DELETED',
      entityType: 'MEDICINE',
      entityId: id,
    });
    return { id, deleted: true };
  }

  async addBarcode(user: AuthenticatedUser, id: string, dto: AddBarcodeDto) {
    const existing = await this.repo.findByIdRaw(user.pharmacyId, id);
    if (!existing) throw new NotFoundException({ errorCode: 'MEDICINE_NOT_FOUND', message: 'Medicine not found' });
    const conflict = await this.repo.findBarcodeConflict(user.pharmacyId, dto.barcode);
    if (conflict) {
      throw new ConflictException({ errorCode: 'BARCODE_TAKEN', message: 'This barcode is already assigned to another medicine.' });
    }
    const created = await this.repo.addBarcode({ medicineId: id, pharmacyId: user.pharmacyId, barcode: dto.barcode, isPrimary: dto.isPrimary ?? false });
    await this.audit.record({
      pharmacyId: user.pharmacyId,
      branchId: existing.branchId ?? user.branchId,
      userId: user.userId,
      action: 'MEDICINE_BARCODE_ADDED',
      entityType: 'MEDICINE',
      entityId: id,
      metadata: { barcode: dto.barcode },
    });
    return created;
  }

  async removeBarcode(user: AuthenticatedUser, id: string, barcodeId: string) {
    const existing = await this.repo.findByIdRaw(user.pharmacyId, id);
    if (!existing) throw new NotFoundException({ errorCode: 'MEDICINE_NOT_FOUND', message: 'Medicine not found' });
    await this.repo.removeBarcode(id, barcodeId);
    await this.audit.record({
      pharmacyId: user.pharmacyId,
      branchId: existing.branchId ?? user.branchId,
      userId: user.userId,
      action: 'MEDICINE_BARCODE_REMOVED',
      entityType: 'MEDICINE',
      entityId: id,
      metadata: { barcodeId },
    });
    return { id, barcodeId, removed: true };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private canSeeCost(role: AuthenticatedUser['role']): boolean {
    return role !== 'cashier';
  }

  private stockStatusOf(currentStock: number, reorderLevel: number): 'in_stock' | 'low' | 'out' {
    if (currentStock <= 0) return 'out';
    if (currentStock <= reorderLevel) return 'low';
    return 'in_stock';
  }

  private enforceControlledRule(schedule: string | null | undefined, prescriptionRequired: boolean | undefined): boolean {
    // Controlled substances must require a prescription — enforced server-side (spec §10/§11).
    if (schedule && schedule.trim() && schedule.toUpperCase() !== 'NONE') return true;
    return prescriptionRequired ?? false;
  }

  private resolveBranch(user: AuthenticatedUser, requestedBranchId?: string): string {
    const branchId = requestedBranchId ?? user.branchId;
    if (!user.accessibleBranchIds.includes(branchId)) {
      throw new ForbiddenException({ errorCode: 'BRANCH_ACCESS_DENIED', message: `You do not have access to branch ${branchId}` });
    }
    return branchId;
  }

  private async assertSkuFree(pharmacyId: string, sku: string) {
    const clash = await this.prisma.medicine.findFirst({ where: { pharmacyId, sku }, select: { id: true } });
    if (clash) throw new ConflictException({ errorCode: 'SKU_TAKEN', message: `SKU "${sku}" is already in use.` });
  }

  private async assertBarcodesFree(pharmacyId: string, barcodes: string[]) {
    for (const barcode of barcodes) {
      const conflict = await this.repo.findBarcodeConflict(pharmacyId, barcode);
      if (conflict) throw new ConflictException({ errorCode: 'BARCODE_TAKEN', message: `Barcode "${barcode}" is already assigned.` });
    }
  }

  private async validateLookups(pharmacyId: string, dto: CreateMedicineDto | UpdateMedicineDto) {
    const checks: Array<[string | undefined, () => Promise<unknown>, string]> = [
      [dto.manufacturerId, () => this.prisma.manufacturer.findFirst({ where: { id: dto.manufacturerId, pharmacyId } }), 'manufacturerId'],
      [dto.categoryId, () => this.prisma.category.findFirst({ where: { id: dto.categoryId, pharmacyId } }), 'categoryId'],
      [dto.dosageFormId, () => this.prisma.dosageForm.findFirst({ where: { id: dto.dosageFormId, pharmacyId } }), 'dosageFormId'],
      [dto.baseUnitId, () => this.prisma.unit.findFirst({ where: { id: dto.baseUnitId, pharmacyId } }), 'baseUnitId'],
      [dto.purchaseUnitId, () => this.prisma.unit.findFirst({ where: { id: dto.purchaseUnitId, pharmacyId } }), 'purchaseUnitId'],
      [dto.saleUnitId, () => this.prisma.unit.findFirst({ where: { id: dto.saleUnitId, pharmacyId } }), 'saleUnitId'],
    ];
    for (const [value, query, field] of checks) {
      if (value === undefined) continue;
      const found = await query();
      if (!found) throw new BadRequestException({ errorCode: 'INVALID_LOOKUP', message: `Referenced ${field} does not exist.` });
    }
  }

  private serializeListRow(
    m: Prisma.MedicineGetPayload<{
      include: { manufacturer: { select: { id: true; name: true } }; category: { select: { id: true; name: true } }; dosageForm: { select: { id: true; name: true } }; barcodes: true };
    }>,
    user: AuthenticatedUser,
  ): Record<string, unknown> {
    const base: Record<string, unknown> = {
      id: m.id,
      sku: m.sku,
      genericName: m.genericName,
      brandName: m.brandName,
      name: m.brandName ?? m.genericName,
      strength: m.strength,
      manufacturer: m.manufacturer,
      category: m.category,
      dosageForm: m.dosageForm,
      sellingPrice: dec(m.sellingPrice),
      mrp: dec(m.mrp),
      taxRatePercent: dec(m.taxRatePercent),
      prescriptionRequired: m.prescriptionRequired,
      controlledSubstanceSchedule: m.controlledSubstanceSchedule,
      status: m.status,
      isActive: m.isActive,
      currentStock: m.currentStock,
      reorderLevel: m.reorderLevel,
      stockStatus: this.stockStatusOf(m.currentStock, m.reorderLevel),
      imageUrl: m.imageUrl,
      primaryBarcode: m.barcodes[0]?.barcode ?? null,
      updatedAt: m.updatedAt.toISOString(),
    };
    if (this.canSeeCost(user.role)) {
      base.costPrice = dec(m.costPrice);
      base.margin = this.marginPct(dec(m.costPrice), dec(m.sellingPrice));
    }
    return base;
  }

  private serializeDetail(m: MedicineWithRelations, user: AuthenticatedUser): Record<string, unknown> {
    const base: Record<string, unknown> = {
      id: m.id,
      pharmacyId: m.pharmacyId,
      branchId: m.branchId,
      isGlobalAcrossBranches: m.isGlobalAcrossBranches,
      sku: m.sku,
      genericName: m.genericName,
      brandName: m.brandName,
      name: m.brandName ?? m.genericName,
      manufacturer: m.manufacturer,
      category: m.category,
      subCategoryId: m.subCategoryId,
      dosageForm: m.dosageForm,
      strength: m.strength,
      routeOfAdministration: m.routeOfAdministration,
      therapeuticClass: m.therapeuticClass,
      storageCondition: m.storageCondition,
      prescriptionRequired: m.prescriptionRequired,
      controlledSubstanceSchedule: m.controlledSubstanceSchedule,
      baseUnit: m.baseUnit,
      purchaseUnit: m.purchaseUnit,
      saleUnit: m.saleUnit,
      unitConversions: m.unitConversions,
      mrp: dec(m.mrp),
      sellingPrice: dec(m.sellingPrice),
      taxRatePercent: dec(m.taxRatePercent),
      taxInclusive: m.taxInclusive,
      discountEligible: m.discountEligible,
      reorderLevel: m.reorderLevel,
      reorderQuantity: m.reorderQuantity,
      maxStockLevel: m.maxStockLevel,
      currentStock: m.currentStock,
      stockStatus: this.stockStatusOf(m.currentStock, m.reorderLevel),
      imageUrl: m.imageUrl,
      documentUrl: m.documentUrl,
      status: m.status,
      isActive: m.isActive,
      barcodes: m.barcodes,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
    if (this.canSeeCost(user.role)) {
      base.costPrice = dec(m.costPrice);
      base.margin = this.marginPct(dec(m.costPrice), dec(m.sellingPrice));
    }
    return base;
  }

  private marginPct(cost: number, selling: number): number | null {
    if (selling <= 0) return null;
    return Math.round(((selling - cost) / selling) * 1000) / 10;
  }
}
