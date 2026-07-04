import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CategoryDto, DosageFormDto, ManufacturerDto, UnitDto } from './dto/lookup.dto';

/**
 * CRUD for the four Medicine lookup entities. Every delete is guarded: a lookup
 * referenced by any Medicine cannot be removed, and the error reports how many
 * medicines depend on it so the UI can explain why (spec §11).
 */
@Injectable()
export class MedicineLookupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  private log(user: AuthenticatedUser, action: string, entityType: string, entityId: string, metadata?: Record<string, unknown>) {
    return this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action, entityType, entityId, metadata });
  }

  private handleUnique(err: unknown, name: string): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictException({ errorCode: 'LOOKUP_EXISTS', message: `"${name}" already exists.` });
    }
    throw err;
  }

  // --- Categories ----------------------------------------------------------
  categories(pharmacyId: string) {
    return this.prisma.category.findMany({ where: { pharmacyId }, orderBy: { name: 'asc' } });
  }

  async createCategory(user: AuthenticatedUser, dto: CategoryDto) {
    try {
      const created = await this.prisma.category.create({
        data: { pharmacyId: user.pharmacyId, name: dto.name, parentId: dto.parentId, isActive: dto.isActive ?? true },
      });
      await this.log(user, 'CATEGORY_CREATED', 'CATEGORY', created.id, { name: dto.name });
      return created;
    } catch (err) {
      this.handleUnique(err, dto.name);
    }
  }

  async updateCategory(user: AuthenticatedUser, id: string, dto: CategoryDto) {
    await this.ensureExists('category', user.pharmacyId, id);
    try {
      const updated = await this.prisma.category.update({ where: { id }, data: { name: dto.name, parentId: dto.parentId ?? null, isActive: dto.isActive } });
      await this.log(user, 'CATEGORY_UPDATED', 'CATEGORY', id, { name: dto.name });
      return updated;
    } catch (err) {
      this.handleUnique(err, dto.name);
    }
  }

  async deleteCategory(user: AuthenticatedUser, id: string) {
    await this.ensureExists('category', user.pharmacyId, id);
    await this.guardInUse('categoryId', id, 'category');
    await this.prisma.category.delete({ where: { id } });
    await this.log(user, 'CATEGORY_DELETED', 'CATEGORY', id);
    return { id, deleted: true };
  }

  // --- Manufacturers -------------------------------------------------------
  manufacturers(pharmacyId: string) {
    return this.prisma.manufacturer.findMany({ where: { pharmacyId }, orderBy: { name: 'asc' } });
  }

  async createManufacturer(user: AuthenticatedUser, dto: ManufacturerDto) {
    try {
      const created = await this.prisma.manufacturer.create({
        data: { pharmacyId: user.pharmacyId, name: dto.name, country: dto.country, contactInfo: dto.contactInfo as Prisma.InputJsonValue, isActive: dto.isActive ?? true },
      });
      await this.log(user, 'MANUFACTURER_CREATED', 'MANUFACTURER', created.id, { name: dto.name });
      return created;
    } catch (err) {
      this.handleUnique(err, dto.name);
    }
  }

  async updateManufacturer(user: AuthenticatedUser, id: string, dto: ManufacturerDto) {
    await this.ensureExists('manufacturer', user.pharmacyId, id);
    try {
      const updated = await this.prisma.manufacturer.update({
        where: { id },
        data: { name: dto.name, country: dto.country, contactInfo: dto.contactInfo as Prisma.InputJsonValue, isActive: dto.isActive },
      });
      await this.log(user, 'MANUFACTURER_UPDATED', 'MANUFACTURER', id, { name: dto.name });
      return updated;
    } catch (err) {
      this.handleUnique(err, dto.name);
    }
  }

  async deleteManufacturer(user: AuthenticatedUser, id: string) {
    await this.ensureExists('manufacturer', user.pharmacyId, id);
    await this.guardInUse('manufacturerId', id, 'manufacturer');
    await this.prisma.manufacturer.delete({ where: { id } });
    await this.log(user, 'MANUFACTURER_DELETED', 'MANUFACTURER', id);
    return { id, deleted: true };
  }

  // --- Dosage forms --------------------------------------------------------
  dosageForms(pharmacyId: string) {
    return this.prisma.dosageForm.findMany({ where: { pharmacyId }, orderBy: { name: 'asc' } });
  }

  async createDosageForm(user: AuthenticatedUser, dto: DosageFormDto) {
    try {
      const created = await this.prisma.dosageForm.create({ data: { pharmacyId: user.pharmacyId, name: dto.name } });
      await this.log(user, 'DOSAGE_FORM_CREATED', 'DOSAGE_FORM', created.id, { name: dto.name });
      return created;
    } catch (err) {
      this.handleUnique(err, dto.name);
    }
  }

  async updateDosageForm(user: AuthenticatedUser, id: string, dto: DosageFormDto) {
    await this.ensureExists('dosageForm', user.pharmacyId, id);
    try {
      const updated = await this.prisma.dosageForm.update({ where: { id }, data: { name: dto.name } });
      await this.log(user, 'DOSAGE_FORM_UPDATED', 'DOSAGE_FORM', id, { name: dto.name });
      return updated;
    } catch (err) {
      this.handleUnique(err, dto.name);
    }
  }

  async deleteDosageForm(user: AuthenticatedUser, id: string) {
    await this.ensureExists('dosageForm', user.pharmacyId, id);
    await this.guardInUse('dosageFormId', id, 'dosage form');
    await this.prisma.dosageForm.delete({ where: { id } });
    await this.log(user, 'DOSAGE_FORM_DELETED', 'DOSAGE_FORM', id);
    return { id, deleted: true };
  }

  // --- Units ---------------------------------------------------------------
  units(pharmacyId: string) {
    return this.prisma.unit.findMany({ where: { pharmacyId }, orderBy: { name: 'asc' } });
  }

  async createUnit(user: AuthenticatedUser, dto: UnitDto) {
    try {
      const created = await this.prisma.unit.create({ data: { pharmacyId: user.pharmacyId, name: dto.name, symbol: dto.symbol } });
      await this.log(user, 'UNIT_CREATED', 'UNIT', created.id, { name: dto.name });
      return created;
    } catch (err) {
      this.handleUnique(err, dto.name);
    }
  }

  async updateUnit(user: AuthenticatedUser, id: string, dto: UnitDto) {
    await this.ensureExists('unit', user.pharmacyId, id);
    try {
      const updated = await this.prisma.unit.update({ where: { id }, data: { name: dto.name, symbol: dto.symbol } });
      await this.log(user, 'UNIT_UPDATED', 'UNIT', id, { name: dto.name });
      return updated;
    } catch (err) {
      this.handleUnique(err, dto.name);
    }
  }

  async deleteUnit(user: AuthenticatedUser, id: string) {
    await this.ensureExists('unit', user.pharmacyId, id);
    const inUse = await this.prisma.medicine.count({
      where: { OR: [{ baseUnitId: id }, { purchaseUnitId: id }, { saleUnitId: id }] },
    });
    if (inUse > 0) {
      throw new ConflictException({ errorCode: 'LOOKUP_IN_USE', message: `Cannot delete: unit is used by ${inUse} medicine(s).`, data: { dependentCount: inUse } });
    }
    await this.prisma.unit.delete({ where: { id } });
    await this.log(user, 'UNIT_DELETED', 'UNIT', id);
    return { id, deleted: true };
  }

  // --- Shared guards -------------------------------------------------------
  private async ensureExists(model: 'category' | 'manufacturer' | 'dosageForm' | 'unit', pharmacyId: string, id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = await (this.prisma[model] as any).findFirst({ where: { id, pharmacyId }, select: { id: true } });
    if (!found) throw new NotFoundException({ errorCode: 'LOOKUP_NOT_FOUND', message: 'Lookup entry not found' });
  }

  private async guardInUse(field: 'categoryId' | 'manufacturerId' | 'dosageFormId', id: string, label: string) {
    const inUse = await this.prisma.medicine.count({ where: { [field]: id } });
    if (inUse > 0) {
      throw new ConflictException({ errorCode: 'LOOKUP_IN_USE', message: `Cannot delete: ${label} is used by ${inUse} medicine(s).`, data: { dependentCount: inUse } });
    }
  }
}
