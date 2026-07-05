import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CustomerEventsEmitter } from './events/customer-events.emitter';
import { AddNoteDto, AssignTagDto, CheckDuplicateDto, CreateCustomerDto, CreateTagDto, QuickAddCustomerDto, UpdateCustomerDto } from './dto/customers.dto';

function dec(v: Prisma.Decimal | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : v.toNumber();
}

// Roles that may see financial rollups (lifetime spend). Deliberately excludes
// pharmacist per the §13 matrix (they get clinical, not financial, visibility).
const SPEND_ROLES = ['super_admin', 'admin', 'accountant', 'auditor'];

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: CustomerEventsEmitter,
    private readonly audit: AuditLogService,
  ) {}

  private canSeeSpend(role: string): boolean {
    return SPEND_ROLES.includes(role);
  }

  // =========================================================================
  // Registration
  // =========================================================================

  /** POS quick-add — single-table insert, <500ms target. Exact-phone dup = 409. */
  async quickAdd(user: AuthenticatedUser, dto: QuickAddCustomerDto) {
    const existing = await this.prisma.customer.findFirst({ where: { pharmacyId: user.pharmacyId, phone: dto.phone } });
    if (existing) {
      throw new ConflictException({ errorCode: 'CUSTOMER_PHONE_EXISTS', message: 'A customer with this phone already exists — search for them instead.', data: { id: existing.id, name: existing.name } });
    }
    const c = await this.prisma.customer.create({ data: { pharmacyId: user.pharmacyId, name: dto.name.trim(), phone: dto.phone, createdBy: user.userId } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'CUSTOMER_CREATED', entityType: 'CUSTOMER', entityId: c.id, metadata: { via: 'quick_add', name: c.name } });
    this.events.created({ pharmacyId: user.pharmacyId, customerId: c.id, via: 'quick_add' });
    return { id: c.id, name: c.name, phone: c.phone };
  }

  async create(user: AuthenticatedUser, dto: CreateCustomerDto) {
    const existing = await this.prisma.customer.findFirst({ where: { pharmacyId: user.pharmacyId, phone: dto.phone } });
    if (existing) throw new ConflictException({ errorCode: 'CUSTOMER_PHONE_EXISTS', message: `A customer with phone ${dto.phone} already exists.`, data: { id: existing.id } });
    const c = await this.prisma.customer.create({
      data: {
        pharmacyId: user.pharmacyId, name: dto.name.trim(), phone: dto.phone, email: dto.email, dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        gender: dto.gender, nationalIdOrPatientId: dto.nationalIdOrPatientId, addressLine1: dto.addressLine1, addressLine2: dto.addressLine2, city: dto.city,
        emergencyContactName: dto.emergencyContactName, emergencyContactPhone: dto.emergencyContactPhone,
        consentHealthDataStorage: dto.consentHealthDataStorage ?? false, consentMarketingContact: dto.consentMarketingContact ?? false, createdBy: user.userId,
      },
    });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'CUSTOMER_CREATED', entityType: 'CUSTOMER', entityId: c.id, metadata: { via: 'full_create', name: c.name } });
    this.events.created({ pharmacyId: user.pharmacyId, customerId: c.id, via: 'full_create' });
    return this.detail(user, c.id);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateCustomerDto) {
    const before = await this.prisma.customer.findFirst({ where: { id, pharmacyId: user.pharmacyId } });
    if (!before) throw new NotFoundException({ errorCode: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
    if (dto.phone && dto.phone !== before.phone) {
      const dup = await this.prisma.customer.findFirst({ where: { pharmacyId: user.pharmacyId, phone: dto.phone, id: { not: id } } });
      if (dup) throw new ConflictException({ errorCode: 'CUSTOMER_PHONE_EXISTS', message: `Phone ${dto.phone} is already used by another customer.` });
    }
    await this.prisma.customer.update({
      where: { id },
      data: {
        name: dto.name?.trim(), phone: dto.phone, email: dto.email, dateOfBirth: dto.dateOfBirth !== undefined ? (dto.dateOfBirth ? new Date(dto.dateOfBirth) : null) : undefined,
        gender: dto.gender, nationalIdOrPatientId: dto.nationalIdOrPatientId, addressLine1: dto.addressLine1, addressLine2: dto.addressLine2, city: dto.city,
        emergencyContactName: dto.emergencyContactName, emergencyContactPhone: dto.emergencyContactPhone, consentHealthDataStorage: dto.consentHealthDataStorage, consentMarketingContact: dto.consentMarketingContact,
      },
    });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'CUSTOMER_UPDATED', entityType: 'CUSTOMER', entityId: id });
    return this.detail(user, id);
  }

  async archive(user: AuthenticatedUser, id: string) {
    const c = await this.prisma.customer.findFirst({ where: { id, pharmacyId: user.pharmacyId } });
    if (!c) throw new NotFoundException({ errorCode: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
    await this.prisma.customer.update({ where: { id }, data: { isActive: false } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'CUSTOMER_ARCHIVED', entityType: 'CUSTOMER', entityId: id, metadata: { name: c.name } });
    return { id, isActive: false };
  }

  async checkDuplicate(user: AuthenticatedUser, dto: CheckDuplicateDto) {
    let hardDuplicate: { id: string; name: string; phone: string } | null = null;
    if (dto.phone) {
      const exact = await this.prisma.customer.findFirst({ where: { pharmacyId: user.pharmacyId, phone: dto.phone }, select: { id: true, name: true, phone: true } });
      if (exact) hardDuplicate = exact;
    }
    // Soft: same name (+ DOB if given) — warn, don't block.
    let softDuplicates: Array<{ id: string; name: string; phone: string }> = [];
    if (dto.name) {
      const rows = await this.prisma.customer.findMany({
        where: { pharmacyId: user.pharmacyId, name: { equals: dto.name.trim(), mode: 'insensitive' }, ...(dto.dateOfBirth ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}), ...(hardDuplicate ? { id: { not: hardDuplicate.id } } : {}) },
        select: { id: true, name: true, phone: true }, take: 5,
      });
      softDuplicates = rows;
    }
    return { hardDuplicate, softDuplicates };
  }

  // =========================================================================
  // List / detail / search
  // =========================================================================

  async list(user: AuthenticatedUser, q: { page?: string; limit?: string; search?: string; tagId?: string; hasAllergiesFlag?: string; registeredFrom?: string; registeredTo?: string }) {
    const page = q.page ? Number(q.page) : 1;
    const limit = q.limit ? Number(q.limit) : 25;
    const where: Prisma.CustomerWhereInput = { pharmacyId: user.pharmacyId, isMergedInto: null };
    if (q.search?.trim()) {
      const t = q.search.trim();
      where.OR = [{ name: { contains: t, mode: 'insensitive' } }, { phone: { contains: t } }, { email: { contains: t, mode: 'insensitive' } }, { nationalIdOrPatientId: { contains: t } }];
    }
    if (q.tagId) where.tags = { some: { tagId: q.tagId } };
    if (q.registeredFrom || q.registeredTo) where.createdAt = { ...(q.registeredFrom ? { gte: new Date(q.registeredFrom) } : {}), ...(q.registeredTo ? { lte: new Date(q.registeredTo) } : {}) };
    // hasAllergiesFlag is a pharmacist/admin-only filter (gated at controller).
    if (q.hasAllergiesFlag === 'true') where.healthProfile = { is: { allergyTags: { isEmpty: false } } };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({ where, orderBy: { name: 'asc' }, skip: (page - 1) * limit, take: limit, include: { tags: { include: {} }, _count: { select: { prescriptions: true } } } }),
    ]);
    const tagIds = [...new Set(rows.flatMap((r) => r.tags.map((t) => t.tagId)))];
    const tags = await this.prisma.customerTag.findMany({ where: { id: { in: tagIds } } });
    const tagOf = new Map(tags.map((t) => [t.id, t]));
    const spendVisible = this.canSeeSpend(user.role);
    const custIds = rows.map((r) => r.id);
    const spendMap = spendVisible ? await this.spendAndLastPurchase(user.pharmacyId, custIds) : new Map();
    const lastMap = await this.lastPurchaseMap(user.pharmacyId, custIds);

    return {
      page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)),
      data: rows.map((c) => ({
        id: c.id, name: c.name, phone: c.phone, registeredAt: c.createdAt.toISOString(), isActive: c.isActive,
        tags: c.tags.map((t) => ({ id: t.tagId, name: tagOf.get(t.tagId)?.name ?? t.tagId, color: tagOf.get(t.tagId)?.color ?? null })),
        prescriptionCount: c._count.prescriptions,
        lastPurchaseAt: lastMap.get(c.id) ?? null,
        ...(spendVisible ? { lifetimeSpend: spendMap.get(c.id) ?? 0 } : {}),
      })),
    };
  }

  /** Narrow typeahead for POS — id/name/phone + a boolean prescription flag only.
   * Deliberately a separate, minimal shape (never health/financial data). */
  async search(user: AuthenticatedUser, term: string) {
    const rows = await this.prisma.customer.findMany({
      where: { pharmacyId: user.pharmacyId, isActive: true, isMergedInto: null, ...(term ? { OR: [{ name: { contains: term, mode: 'insensitive' } }, { phone: { contains: term } }] } : {}) },
      orderBy: { name: 'asc' }, take: 20, select: { id: true, name: true, phone: true, _count: { select: { prescriptions: true } } },
    });
    return rows.map((c) => ({ id: c.id, name: c.name, phone: c.phone, hasPrescriptionOnFile: c._count.prescriptions > 0 }));
  }

  /** Basic detail — NEVER includes health data (that is a separate gated endpoint). */
  async detail(user: AuthenticatedUser, id: string) {
    const c = await this.prisma.customer.findFirst({
      where: { id, pharmacyId: user.pharmacyId },
      include: { tags: true, notes: { orderBy: { createdAt: 'desc' } }, _count: { select: { prescriptions: true } } },
    });
    if (!c) throw new NotFoundException({ errorCode: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
    const tags = await this.prisma.customerTag.findMany({ where: { id: { in: c.tags.map((t) => t.tagId) } } });
    const tagOf = new Map(tags.map((t) => [t.id, t]));
    const spendVisible = this.canSeeSpend(user.role);
    const spend = spendVisible ? (await this.spendAndLastPurchase(user.pharmacyId, [id])).get(id) ?? 0 : undefined;
    return {
      id: c.id, name: c.name, phone: c.phone, email: c.email, dateOfBirth: c.dateOfBirth?.toISOString() ?? null, gender: c.gender,
      nationalIdOrPatientId: c.nationalIdOrPatientId, addressLine1: c.addressLine1, addressLine2: c.addressLine2, city: c.city,
      emergencyContactName: c.emergencyContactName, emergencyContactPhone: c.emergencyContactPhone,
      consentHealthDataStorage: c.consentHealthDataStorage, consentMarketingContact: c.consentMarketingContact,
      isActive: c.isActive, isMergedInto: c.isMergedInto, registeredAt: c.createdAt.toISOString(),
      prescriptionCount: c._count.prescriptions,
      tags: c.tags.map((t) => ({ id: t.tagId, name: tagOf.get(t.tagId)?.name ?? t.tagId, color: tagOf.get(t.tagId)?.color ?? null })),
      notes: c.notes.map((n) => ({ id: n.id, note: n.note, createdBy: n.createdBy, createdAt: n.createdAt.toISOString() })),
      ...(spendVisible ? { lifetimeSpend: spend } : {}),
      // Signals health data exists WITHOUT exposing it — the tab only fetches if the role is allowed.
      hasHealthProfile: !!(await this.prisma.customerHealthProfile.count({ where: { customerId: id } })),
    };
  }

  // =========================================================================
  // Purchase & medication history (live from Module 4)
  // =========================================================================
  async purchaseHistory(user: AuthenticatedUser, id: string, page = 1, limit = 20) {
    await this.ensure(user, id);
    const where: Prisma.SaleWhereInput = { pharmacyId: user.pharmacyId, customerId: id };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({ where, orderBy: { saleDate: 'desc' }, skip: (page - 1) * limit, take: limit, include: { _count: { select: { items: true } }, payments: { select: { method: true } } } }),
    ]);
    return {
      page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)),
      data: rows.map((s) => ({ id: s.id, saleNumber: s.saleNumber, saleDate: s.saleDate.toISOString(), status: s.status, itemCount: s._count.items, grandTotal: dec(s.grandTotal), methods: [...new Set(s.payments.map((p) => p.method))] })),
    };
  }

  /** Medication history summary — which medicines, when last (informational aid). */
  async medicationSummary(user: AuthenticatedUser, id: string) {
    await this.ensure(user, id);
    const items = await this.prisma.saleItem.findMany({ where: { sale: { pharmacyId: user.pharmacyId, customerId: id, status: 'COMPLETED' } }, select: { medicineId: true, quantity: true, sale: { select: { saleDate: true } } } });
    const byMed = new Map<string, { quantity: number; lastPurchased: Date }>();
    for (const it of items) {
      const e = byMed.get(it.medicineId);
      if (!e) byMed.set(it.medicineId, { quantity: it.quantity, lastPurchased: it.sale.saleDate });
      else { e.quantity += it.quantity; if (it.sale.saleDate > e.lastPurchased) e.lastPurchased = it.sale.saleDate; }
    }
    const meds = await this.prisma.medicine.findMany({ where: { id: { in: [...byMed.keys()] } }, select: { id: true, brandName: true, genericName: true } });
    const nameOf = new Map(meds.map((m) => [m.id, m.brandName ?? m.genericName]));
    return [...byMed.entries()].map(([medicineId, v]) => ({ medicineId, medicineName: nameOf.get(medicineId) ?? medicineId, totalQuantity: v.quantity, lastPurchased: v.lastPurchased.toISOString() })).sort((a, b) => (a.lastPurchased < b.lastPurchased ? 1 : -1));
  }

  // =========================================================================
  // Tags / notes
  // =========================================================================
  async listTags(user: AuthenticatedUser) {
    return this.prisma.customerTag.findMany({ where: { pharmacyId: user.pharmacyId }, orderBy: { name: 'asc' } });
  }
  async createTag(user: AuthenticatedUser, dto: CreateTagDto) {
    const dup = await this.prisma.customerTag.findFirst({ where: { pharmacyId: user.pharmacyId, name: dto.name } });
    if (dup) throw new ConflictException({ errorCode: 'TAG_EXISTS', message: `A tag named "${dto.name}" already exists.` });
    return this.prisma.customerTag.create({ data: { pharmacyId: user.pharmacyId, name: dto.name, color: dto.color } });
  }
  async deleteTag(user: AuthenticatedUser, tagId: string) {
    const tag = await this.prisma.customerTag.findFirst({ where: { id: tagId, pharmacyId: user.pharmacyId } });
    if (!tag) throw new NotFoundException({ errorCode: 'TAG_NOT_FOUND', message: 'Tag not found' });
    await this.prisma.customerTagAssignment.deleteMany({ where: { tagId } }); // cascade assignments
    await this.prisma.customerTag.delete({ where: { id: tagId } });
    return { id: tagId, deleted: true };
  }
  async assignTag(user: AuthenticatedUser, customerId: string, dto: AssignTagDto) {
    await this.ensure(user, customerId);
    const tag = await this.prisma.customerTag.findFirst({ where: { id: dto.tagId, pharmacyId: user.pharmacyId } });
    if (!tag) throw new BadRequestException({ errorCode: 'INVALID_TAG', message: 'Tag not found.' });
    const a = await this.prisma.customerTagAssignment.upsert({ where: { customerId_tagId: { customerId, tagId: dto.tagId } }, update: {}, create: { customerId, tagId: dto.tagId, assignedBy: user.userId } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'CUSTOMER_TAG_ASSIGNED', entityType: 'CUSTOMER', entityId: customerId, metadata: { tagId: dto.tagId } });
    return { id: a.id };
  }
  async removeTag(user: AuthenticatedUser, customerId: string, tagId: string) {
    await this.ensure(user, customerId);
    await this.prisma.customerTagAssignment.deleteMany({ where: { customerId, tagId } });
    return { removed: true };
  }
  async addNote(user: AuthenticatedUser, customerId: string, dto: AddNoteDto) {
    await this.ensure(user, customerId);
    const n = await this.prisma.customerNote.create({ data: { customerId, note: dto.note, createdBy: user.userId } });
    return { id: n.id };
  }

  // =========================================================================
  private async ensure(user: AuthenticatedUser, id: string) {
    const c = await this.prisma.customer.findFirst({ where: { id, pharmacyId: user.pharmacyId }, select: { id: true } });
    if (!c) throw new NotFoundException({ errorCode: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
  }

  private async spendAndLastPurchase(pharmacyId: string, customerIds: string[]): Promise<Map<string, number>> {
    if (customerIds.length === 0) return new Map();
    const grouped = await this.prisma.sale.groupBy({ by: ['customerId'], where: { pharmacyId, customerId: { in: customerIds }, status: 'COMPLETED' }, _sum: { grandTotal: true } });
    return new Map(grouped.map((g) => [g.customerId as string, Math.round(dec(g._sum?.grandTotal) * 100) / 100]));
  }
  private async lastPurchaseMap(pharmacyId: string, customerIds: string[]): Promise<Map<string, string>> {
    if (customerIds.length === 0) return new Map();
    const grouped = await this.prisma.sale.groupBy({ by: ['customerId'], where: { pharmacyId, customerId: { in: customerIds } }, _max: { saleDate: true } });
    return new Map(grouped.filter((g) => g._max?.saleDate).map((g) => [g.customerId as string, g._max!.saleDate!.toISOString()]));
  }
}
