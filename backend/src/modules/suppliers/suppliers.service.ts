import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SupplierType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { SupplierEventsEmitter } from './events/supplier-events.emitter';
import { SupplierPerformanceService } from './supplier-performance.service';
import { AddAddressDto, AddContactDto, CreateSupplierDto, QuerySuppliersDto, SetNegotiatedPriceDto, SetPreferredSupplierDto, UpdateSupplierDto, UploadDocumentDto } from './dto/suppliers.dto';

function dec(v: Prisma.Decimal | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : v.toNumber();
}

const BANK_ROLES = ['super_admin', 'admin', 'accountant'];
const LICENSE_THRESHOLD_DAYS = 90;

type LicenseStatus = 'none' | 'valid' | 'expiring' | 'expired';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perf: SupplierPerformanceService,
    private readonly events: SupplierEventsEmitter,
    private readonly audit: AuditLogService,
  ) {}

  private canSeeBank(role: string): boolean {
    return BANK_ROLES.includes(role);
  }

  private licenseStatus(expiry: Date | null, now = new Date()): { status: LicenseStatus; daysToExpiry: number | null } {
    if (!expiry) return { status: 'none', daysToExpiry: null };
    const days = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
    if (days < 0) return { status: 'expired', daysToExpiry: days };
    if (days <= LICENSE_THRESHOLD_DAYS) return { status: 'expiring', daysToExpiry: days };
    return { status: 'valid', daysToExpiry: days };
  }

  private redactBank<T extends { bankAccountDetails?: unknown }>(row: T, role: string): T {
    if (this.canSeeBank(role)) return row;
    const { bankAccountDetails, ...rest } = row;
    return rest as T;
  }

  // =========================================================================
  // List / detail
  // =========================================================================
  async list(user: AuthenticatedUser, q: QuerySuppliersDto) {
    const page = q.page ? Number(q.page) : 1;
    const limit = q.limit ? Number(q.limit) : 25;
    const where: Prisma.SupplierWhereInput = { pharmacyId: user.pharmacyId };
    if (q.supplierType) where.supplierType = q.supplierType as SupplierType;
    if (q.isActive === 'true') where.isActive = true;
    if (q.isActive === 'false') where.isActive = false;
    if (q.search?.trim()) {
      const term = q.search.trim();
      where.OR = [{ companyName: { contains: term, mode: 'insensitive' } }, { tradingName: { contains: term, mode: 'insensitive' } }, { taxRegistrationNumber: { contains: term, mode: 'insensitive' } }];
    }
    if (q.licenseStatus) {
      const now = new Date();
      if (q.licenseStatus === 'expired') where.drugLicenseExpiry = { lt: now };
      else if (q.licenseStatus === 'expiring') where.drugLicenseExpiry = { gte: now, lte: new Date(now.getTime() + LICENSE_THRESHOLD_DAYS * 86400000) };
      else if (q.licenseStatus === 'valid') where.drugLicenseExpiry = { gt: new Date(now.getTime() + LICENSE_THRESHOLD_DAYS * 86400000) };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({ where, orderBy: { companyName: q.sortOrder === 'desc' ? 'desc' : 'asc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    const agg = await this.perf.listAggregates(user.pharmacyId, rows.map((r) => r.id));
    const now = new Date();
    let data = rows.map((s) => {
      const lic = this.licenseStatus(s.drugLicenseExpiry, now);
      const a = agg.get(s.id) ?? { totalSpend: 0, outstanding: 0 };
      return { id: s.id, companyName: s.companyName, tradingName: s.tradingName, supplierType: s.supplierType, isActive: s.isActive, paymentTermsCode: s.paymentTermsCode, currency: s.currency, licenseStatus: lic.status, licenseDaysToExpiry: lic.daysToExpiry, totalSpend: a.totalSpend, outstanding: a.outstanding };
    });
    // Post-filter/sort that need aggregates (kept in-app on the current page).
    if (q.hasOutstandingPayables === 'true') data = data.filter((d) => d.outstanding > 0);
    if (q.sortBy === 'totalSpend') data.sort((x, y) => (q.sortOrder === 'asc' ? x.totalSpend - y.totalSpend : y.totalSpend - x.totalSpend));
    if (q.sortBy === 'outstanding') data.sort((x, y) => (q.sortOrder === 'asc' ? x.outstanding - y.outstanding : y.outstanding - x.outstanding));

    return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), data };
  }

  /** Minimal active-supplier list for the PO picker (Module 3 reuse). */
  async activeList(user: AuthenticatedUser) {
    const rows = await this.prisma.supplier.findMany({ where: { pharmacyId: user.pharmacyId, isActive: true }, orderBy: { companyName: 'asc' }, select: { id: true, companyName: true, paymentTermsCode: true } });
    // `name` alias keeps Module 3's existing picker working unchanged.
    return rows.map((s) => ({ id: s.id, name: s.companyName, companyName: s.companyName, paymentTermsCode: s.paymentTermsCode }));
  }

  async detail(user: AuthenticatedUser, id: string) {
    const s = await this.prisma.supplier.findFirst({
      where: { id, pharmacyId: user.pharmacyId },
      include: { contacts: { orderBy: { isPrimary: 'desc' } }, addresses: true, documents: { orderBy: { uploadedAt: 'desc' } }, medicinePrices: { orderBy: { effectiveFrom: 'desc' } } },
    });
    if (!s) throw new NotFoundException({ errorCode: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' });
    const now = new Date();
    const lic = this.licenseStatus(s.drugLicenseExpiry, now);
    const medIds = [...new Set(s.medicinePrices.map((p) => p.medicineId))];
    const meds = await this.prisma.medicine.findMany({ where: { id: { in: medIds } }, select: { id: true, brandName: true, genericName: true } });
    const nameOf = new Map(meds.map((m) => [m.id, m.brandName ?? m.genericName]));
    const out = {
      id: s.id,
      companyName: s.companyName,
      tradingName: s.tradingName,
      supplierType: s.supplierType,
      taxRegistrationNumber: s.taxRegistrationNumber,
      drugLicenseNumber: s.drugLicenseNumber,
      drugLicenseExpiry: s.drugLicenseExpiry?.toISOString() ?? null,
      licenseStatus: lic.status,
      licenseDaysToExpiry: lic.daysToExpiry,
      paymentTermsCode: s.paymentTermsCode,
      currency: s.currency,
      bankAccountDetails: s.bankAccountDetails,
      notes: s.notes,
      isActive: s.isActive,
      createdAt: s.createdAt.toISOString(),
      contacts: s.contacts.map((c) => ({ id: c.id, name: c.name, designation: c.designation, phone: c.phone, email: c.email, isPrimary: c.isPrimary })),
      addresses: s.addresses.map((a) => ({ id: a.id, type: a.type, addressLine1: a.addressLine1, addressLine2: a.addressLine2, city: a.city, state: a.state, country: a.country, postalCode: a.postalCode })),
      documents: s.documents.map((d) => ({ id: d.id, documentType: d.documentType, fileUrl: d.fileUrl, expiryDate: d.expiryDate?.toISOString() ?? null, uploadedAt: d.uploadedAt.toISOString(), ...this.licenseStatus(d.expiryDate, now) })),
      pricing: s.medicinePrices.map((p) => ({ id: p.id, medicineId: p.medicineId, medicineName: nameOf.get(p.medicineId) ?? p.medicineId, negotiatedCost: dec(p.negotiatedCost), effectiveFrom: p.effectiveFrom.toISOString(), effectiveTo: p.effectiveTo?.toISOString() ?? null })),
    };
    return this.redactBank(out, user.role);
  }

  // =========================================================================
  // Create / update / archive / delete
  // =========================================================================
  async create(user: AuthenticatedUser, dto: CreateSupplierDto) {
    const exists = await this.prisma.supplier.findFirst({ where: { pharmacyId: user.pharmacyId, companyName: dto.companyName } });
    if (exists) throw new ConflictException({ errorCode: 'SUPPLIER_EXISTS', message: `A supplier named "${dto.companyName}" already exists.` });
    this.validateContacts(dto.contacts);

    const contacts = this.normalizePrimary(dto.contacts ?? []);
    const created = await this.prisma.supplier.create({
      data: {
        pharmacyId: user.pharmacyId,
        companyName: dto.companyName,
        tradingName: dto.tradingName,
        supplierType: dto.supplierType as SupplierType,
        taxRegistrationNumber: dto.taxRegistrationNumber,
        drugLicenseNumber: dto.drugLicenseNumber,
        drugLicenseExpiry: dto.drugLicenseExpiry ? new Date(dto.drugLicenseExpiry) : null,
        paymentTermsCode: dto.paymentTermsCode,
        currency: dto.currency ?? 'PKR',
        bankAccountDetails: (dto.bankAccountDetails ?? undefined) as Prisma.InputJsonValue | undefined,
        notes: dto.notes,
        createdBy: user.userId,
        contacts: { create: contacts.map((c) => ({ name: c.name, designation: c.designation, phone: c.phone, email: c.email, isPrimary: c.isPrimary ?? false })) },
        addresses: { create: (dto.addresses ?? []).map((a) => ({ type: a.type, addressLine1: a.addressLine1, addressLine2: a.addressLine2, city: a.city, state: a.state, country: a.country, postalCode: a.postalCode })) },
      },
    });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'SUPPLIER_CREATED', entityType: 'SUPPLIER', entityId: created.id, metadata: { companyName: created.companyName, supplierType: created.supplierType } });
    this.events.created({ pharmacyId: user.pharmacyId, supplierId: created.id });
    return this.detail(user, created.id);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateSupplierDto) {
    const before = await this.prisma.supplier.findFirst({ where: { id, pharmacyId: user.pharmacyId } });
    if (!before) throw new NotFoundException({ errorCode: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' });
    if (dto.companyName && dto.companyName !== before.companyName) {
      const dup = await this.prisma.supplier.findFirst({ where: { pharmacyId: user.pharmacyId, companyName: dto.companyName, id: { not: id } } });
      if (dup) throw new ConflictException({ errorCode: 'SUPPLIER_EXISTS', message: `A supplier named "${dto.companyName}" already exists.` });
    }
    await this.prisma.supplier.update({
      where: { id },
      data: {
        companyName: dto.companyName,
        tradingName: dto.tradingName,
        supplierType: dto.supplierType as SupplierType | undefined,
        taxRegistrationNumber: dto.taxRegistrationNumber,
        drugLicenseNumber: dto.drugLicenseNumber,
        drugLicenseExpiry: dto.drugLicenseExpiry !== undefined ? (dto.drugLicenseExpiry ? new Date(dto.drugLicenseExpiry) : null) : undefined,
        paymentTermsCode: dto.paymentTermsCode,
        currency: dto.currency,
        bankAccountDetails: dto.bankAccountDetails !== undefined ? (dto.bankAccountDetails as Prisma.InputJsonValue) : undefined,
        notes: dto.notes,
        updatedBy: user.userId,
      },
    });
    // Before/after diff for financially-sensitive fields (spec §14).
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (dto.paymentTermsCode && dto.paymentTermsCode !== before.paymentTermsCode) changes.paymentTermsCode = { from: before.paymentTermsCode, to: dto.paymentTermsCode };
    if (dto.bankAccountDetails !== undefined) changes.bankAccountDetails = { from: '***', to: '*** (updated)' };
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'SUPPLIER_UPDATED', entityType: 'SUPPLIER', entityId: id, metadata: { changes } });
    return this.detail(user, id);
  }

  async archive(user: AuthenticatedUser, id: string) {
    const s = await this.prisma.supplier.findFirst({ where: { id, pharmacyId: user.pharmacyId } });
    if (!s) throw new NotFoundException({ errorCode: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' });
    await this.prisma.supplier.update({ where: { id }, data: { isActive: false, updatedBy: user.userId } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'SUPPLIER_ARCHIVED', entityType: 'SUPPLIER', entityId: id, metadata: { companyName: s.companyName } });
    this.events.archived({ pharmacyId: user.pharmacyId, supplierId: id });
    return { id, isActive: false };
  }

  async hardDelete(user: AuthenticatedUser, id: string) {
    const s = await this.prisma.supplier.findFirst({ where: { id, pharmacyId: user.pharmacyId } });
    if (!s) throw new NotFoundException({ errorCode: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' });
    const poCount = await this.prisma.purchaseOrder.count({ where: { supplierId: id } });
    if (poCount > 0) throw new ConflictException({ errorCode: 'SUPPLIER_HAS_HISTORY', message: `Cannot delete — this supplier is referenced by ${poCount} purchase order(s). Archive it instead.`, data: { purchaseOrderCount: poCount } });
    const tplCount = await this.prisma.purchaseOrderTemplate.count({ where: { supplierId: id } });
    if (tplCount > 0) throw new ConflictException({ errorCode: 'SUPPLIER_HAS_TEMPLATES', message: `Cannot delete — this supplier is referenced by ${tplCount} PO template(s).` });
    await this.prisma.supplier.delete({ where: { id } }); // cascades contacts/addresses/documents/prices
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'SUPPLIER_DELETED', entityType: 'SUPPLIER', entityId: id, metadata: { companyName: s.companyName } });
    return { id, deleted: true };
  }

  // =========================================================================
  // Contacts / addresses / documents
  // =========================================================================
  private validateContacts(contacts?: AddContactDto[]) {
    for (const c of contacts ?? []) {
      if (!c.phone?.trim() && !c.email?.trim()) throw new BadRequestException({ errorCode: 'CONTACT_NEEDS_PHONE_OR_EMAIL', message: `Contact "${c.name}" needs at least a phone or an email.` });
    }
  }

  private normalizePrimary(contacts: AddContactDto[]): AddContactDto[] {
    // At most one primary; if any exist and none is primary, make the first primary.
    let seenPrimary = false;
    const out = contacts.map((c) => {
      const isPrimary = !!c.isPrimary && !seenPrimary;
      if (isPrimary) seenPrimary = true;
      return { ...c, isPrimary };
    });
    if (out.length && !seenPrimary) out[0].isPrimary = true;
    return out;
  }

  private async ensureSupplier(user: AuthenticatedUser, id: string) {
    const s = await this.prisma.supplier.findFirst({ where: { id, pharmacyId: user.pharmacyId } });
    if (!s) throw new NotFoundException({ errorCode: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' });
    return s;
  }

  async addContact(user: AuthenticatedUser, supplierId: string, dto: AddContactDto) {
    await this.ensureSupplier(user, supplierId);
    this.validateContacts([dto]);
    if (dto.isPrimary) await this.prisma.supplierContact.updateMany({ where: { supplierId }, data: { isPrimary: false } });
    const c = await this.prisma.supplierContact.create({ data: { supplierId, name: dto.name, designation: dto.designation, phone: dto.phone, email: dto.email, isPrimary: dto.isPrimary ?? false } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'SUPPLIER_CONTACT_ADDED', entityType: 'SUPPLIER', entityId: supplierId, metadata: { contactId: c.id, name: c.name } });
    return { id: c.id };
  }

  async updateContact(user: AuthenticatedUser, supplierId: string, contactId: string, dto: AddContactDto) {
    await this.ensureSupplier(user, supplierId);
    const existing = await this.prisma.supplierContact.findFirst({ where: { id: contactId, supplierId } });
    if (!existing) throw new NotFoundException({ errorCode: 'CONTACT_NOT_FOUND', message: 'Contact not found' });
    this.validateContacts([dto]);
    if (dto.isPrimary) await this.prisma.supplierContact.updateMany({ where: { supplierId, id: { not: contactId } }, data: { isPrimary: false } });
    await this.prisma.supplierContact.update({ where: { id: contactId }, data: { name: dto.name, designation: dto.designation, phone: dto.phone, email: dto.email, isPrimary: dto.isPrimary ?? existing.isPrimary } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'SUPPLIER_CONTACT_UPDATED', entityType: 'SUPPLIER', entityId: supplierId, metadata: { contactId } });
    return { id: contactId };
  }

  async removeContact(user: AuthenticatedUser, supplierId: string, contactId: string) {
    await this.ensureSupplier(user, supplierId);
    const existing = await this.prisma.supplierContact.findFirst({ where: { id: contactId, supplierId } });
    if (!existing) throw new NotFoundException({ errorCode: 'CONTACT_NOT_FOUND', message: 'Contact not found' });
    await this.prisma.supplierContact.delete({ where: { id: contactId } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'SUPPLIER_CONTACT_REMOVED', entityType: 'SUPPLIER', entityId: supplierId, metadata: { contactId } });
    return { id: contactId, removed: true };
  }

  async addAddress(user: AuthenticatedUser, supplierId: string, dto: AddAddressDto) {
    await this.ensureSupplier(user, supplierId);
    const a = await this.prisma.supplierAddress.create({ data: { supplierId, type: dto.type, addressLine1: dto.addressLine1, addressLine2: dto.addressLine2, city: dto.city, state: dto.state, country: dto.country, postalCode: dto.postalCode } });
    return { id: a.id };
  }

  async addDocument(user: AuthenticatedUser, supplierId: string, dto: UploadDocumentDto) {
    await this.ensureSupplier(user, supplierId);
    const d = await this.prisma.supplierDocument.create({ data: { supplierId, documentType: dto.documentType, fileUrl: dto.fileUrl, expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null, uploadedBy: user.userId } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'SUPPLIER_DOCUMENT_UPLOADED', entityType: 'SUPPLIER', entityId: supplierId, metadata: { documentId: d.id, documentType: d.documentType } });
    return { id: d.id };
  }

  async expiringDocuments(user: AuthenticatedUser, supplierId: string, thresholdDays = LICENSE_THRESHOLD_DAYS) {
    await this.ensureSupplier(user, supplierId);
    const now = new Date();
    const limit = new Date(now.getTime() + thresholdDays * 86400000);
    const docs = await this.prisma.supplierDocument.findMany({ where: { supplierId, expiryDate: { not: null, lte: limit } }, orderBy: { expiryDate: 'asc' } });
    return docs.map((d) => ({ id: d.id, documentType: d.documentType, fileUrl: d.fileUrl, expiryDate: d.expiryDate?.toISOString() ?? null, ...this.licenseStatus(d.expiryDate, now) }));
  }

  /** System-wide "suppliers needing attention" — expiring/expired licenses + overdue payables. */
  async needingAttention(user: AuthenticatedUser) {
    const now = new Date();
    const soon = new Date(now.getTime() + LICENSE_THRESHOLD_DAYS * 86400000);
    const licenseRisk = await this.prisma.supplier.findMany({ where: { pharmacyId: user.pharmacyId, drugLicenseExpiry: { not: null, lte: soon } }, orderBy: { drugLicenseExpiry: 'asc' } });
    const payables = await this.perf.payablesSummary(user.pharmacyId);
    return {
      licenseRisk: licenseRisk.map((s) => ({ id: s.id, companyName: s.companyName, drugLicenseNumber: s.drugLicenseNumber, drugLicenseExpiry: s.drugLicenseExpiry?.toISOString() ?? null, ...this.licenseStatus(s.drugLicenseExpiry, now) })),
      overduePayables: payables.suppliers,
    };
  }

  // =========================================================================
  // Negotiated pricing / preferred supplier
  // =========================================================================
  async setPrice(user: AuthenticatedUser, supplierId: string, dto: SetNegotiatedPriceDto) {
    await this.ensureSupplier(user, supplierId);
    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (effectiveTo && effectiveTo.getTime() <= effectiveFrom.getTime()) throw new BadRequestException({ errorCode: 'INVALID_PRICE_WINDOW', message: 'Effective-to must be after effective-from.' });
    const p = await this.prisma.supplierMedicinePrice.upsert({
      where: { supplierId_medicineId_effectiveFrom: { supplierId, medicineId: dto.medicineId, effectiveFrom } },
      update: { negotiatedCost: dto.negotiatedCost, effectiveTo },
      create: { supplierId, medicineId: dto.medicineId, negotiatedCost: dto.negotiatedCost, effectiveFrom, effectiveTo, createdBy: user.userId },
    });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'SUPPLIER_NEGOTIATED_PRICE_SET', entityType: 'SUPPLIER', entityId: supplierId, metadata: { medicineId: dto.medicineId, negotiatedCost: dto.negotiatedCost } });
    return { id: p.id };
  }

  async listPrices(user: AuthenticatedUser, supplierId: string) {
    await this.ensureSupplier(user, supplierId);
    const rows = await this.prisma.supplierMedicinePrice.findMany({ where: { supplierId }, orderBy: { effectiveFrom: 'desc' } });
    return rows.map((p) => ({ id: p.id, medicineId: p.medicineId, negotiatedCost: dec(p.negotiatedCost), effectiveFrom: p.effectiveFrom.toISOString(), effectiveTo: p.effectiveTo?.toISOString() ?? null }));
  }

  /** Deterministic current-price resolution: latest effectiveFrom ≤ now with a still-open window. */
  async currentPrice(supplierId: string, medicineId: string): Promise<number | null> {
    const now = new Date();
    const rows = await this.prisma.supplierMedicinePrice.findMany({ where: { supplierId, medicineId, effectiveFrom: { lte: now } }, orderBy: { effectiveFrom: 'desc' } });
    const active = rows.find((r) => !r.effectiveTo || r.effectiveTo.getTime() > now.getTime());
    return active ? dec(active.negotiatedCost) : null;
  }

  async setPreferredSupplier(user: AuthenticatedUser, dto: SetPreferredSupplierDto) {
    await this.ensureSupplier(user, dto.supplierId);
    const p = await this.prisma.medicinePreferredSupplier.upsert({
      where: { pharmacyId_medicineId_supplierId: { pharmacyId: user.pharmacyId, medicineId: dto.medicineId, supplierId: dto.supplierId } },
      update: { priority: dto.priority ?? 1 },
      create: { pharmacyId: user.pharmacyId, medicineId: dto.medicineId, supplierId: dto.supplierId, priority: dto.priority ?? 1 },
    });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'PREFERRED_SUPPLIER_SET', entityType: 'MEDICINE', entityId: dto.medicineId, metadata: { supplierId: dto.supplierId, priority: dto.priority ?? 1 } });
    return { id: p.id };
  }

  async preferredForMedicine(user: AuthenticatedUser, medicineId: string) {
    const rows = await this.prisma.medicinePreferredSupplier.findMany({ where: { pharmacyId: user.pharmacyId, medicineId }, orderBy: { priority: 'asc' } });
    const suppliers = await this.prisma.supplier.findMany({ where: { id: { in: rows.map((r) => r.supplierId) } }, select: { id: true, companyName: true, isActive: true } });
    const byId = new Map(suppliers.map((s) => [s.id, s]));
    return rows.map((r) => ({ supplierId: r.supplierId, companyName: byId.get(r.supplierId)?.companyName ?? r.supplierId, isActive: byId.get(r.supplierId)?.isActive ?? true, priority: r.priority }));
  }
}
