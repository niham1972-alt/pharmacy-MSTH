import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { SalesRepository } from './sales.repository';
import { SalesEventsEmitter } from './events/sales-events.emitter';
import { BatchesService } from '../batches/batches.service';
import { SettingsService } from '../settings/settings.service';
import { computeCart, LineInput } from './cart-calculations.util';
import { FinalizeSaleDto, ParkSaleDto, PriceCheckDto, VoidSaleDto } from './dto/sales.dto';

function dec(v: Prisma.Decimal | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : v.toNumber();
}

const ELEVATED = ['admin', 'super_admin', 'pharmacist'];
// Negative-stock policy, auto-approved discount %, and the void window are now
// sourced live from Module 18 Settings (canonical, admin-editable) rather than env.

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: SalesRepository,
    private readonly audit: AuditLogService,
    private readonly events: SalesEventsEmitter,
    private readonly batches: BatchesService,
    private readonly settings: SettingsService,
  ) {}

  private branch(user: AuthenticatedUser, requested?: string): string {
    const branchId = requested ?? user.branchId;
    if (!user.accessibleBranchIds.includes(branchId)) throw new ForbiddenException({ errorCode: 'BRANCH_ACCESS_DENIED', message: `No access to branch ${branchId}` });
    return branchId;
  }

  // -------------------------------------------------------------------------
  // Price check (advisory pre-flight)
  // -------------------------------------------------------------------------
  async priceCheck(user: AuthenticatedUser, dto: PriceCheckDto) {
    const branchId = this.branch(user, dto.branchId);
    const medIds = dto.items.map((i) => i.medicineId);
    const meds = await this.loadMedicines(user.pharmacyId, medIds);
    // FEFO preview via Module 6 — the soonest *sellable* batch (excludes expired
    // and recalled) that a sale would draw from.
    const fefoBatch = await this.batches.previewFefoBatches(user.pharmacyId, branchId, medIds);
    const allowNegative = await this.settings.get<boolean>('sales.allowNegativeStock', { pharmacyId: user.pharmacyId, branchId });

    const lines = dto.items.map((it) => {
      const m = meds.get(it.medicineId)!;
      const unitPrice = this.resolvePrice(user, it, m);
      const line: LineInput = { unitPrice, quantity: it.quantity, discountAmount: it.discountAmount ?? 0, taxRatePercent: dec(m.taxRatePercent), taxInclusive: m.taxInclusive, unitCost: dec(m.costPrice) };
      const stockOk = allowNegative || m.currentStock >= it.quantity;
      return { medicineId: it.medicineId, name: m.brandName ?? m.genericName, unitPrice, currentStock: m.currentStock, stockOk, prescriptionRequired: m.prescriptionRequired, controlled: !!m.controlledSubstanceSchedule, discontinued: m.status === 'DISCONTINUED', fefoBatch: fefoBatch.get(it.medicineId) ?? null, line };
    });
    const { totals } = computeCart(lines.map((l) => l.line));
    return { lines: lines.map(({ line, ...rest }) => ({ ...rest, ...line })), totals };
  }

  // -------------------------------------------------------------------------
  // Finalize sale (the transactional core)
  // -------------------------------------------------------------------------
  async finalize(user: AuthenticatedUser, dto: FinalizeSaleDto) {
    const branchId = this.branch(user, dto.branchId);

    // Idempotency: a retried request with the same key returns the first sale.
    if (dto.idempotencyKey) {
      const existing = await this.repo.findSaleForIdempotency(user.pharmacyId, dto.idempotencyKey);
      if (existing) return this.getById(user, existing.id);
    }

    // Session must be open and belong to this cashier.
    const session = dto.cashierSessionId
      ? await this.repo.sessionById(user.pharmacyId, dto.cashierSessionId)
      : await this.repo.currentOpenSession(user.pharmacyId, branchId, user.userId);
    if (!session || session.status !== 'OPEN') throw new BadRequestException({ errorCode: 'NO_OPEN_SESSION', message: 'Open a cashier session before selling.' });
    if (session.cashierId !== user.userId && !ELEVATED.includes(user.role)) throw new ForbiddenException({ errorCode: 'NOT_OWN_SESSION', message: 'Session belongs to another cashier.' });

    const meds = await this.loadMedicines(user.pharmacyId, dto.items.map((i) => i.medicineId));

    // Live business rules from Module 18 Settings (branch override → pharmacy → default).
    const cfg = await this.settings.getMany(['sales.discount.autoApprovedPercent', 'sales.allowNegativeStock'], { pharmacyId: user.pharmacyId, branchId });
    const autoDiscountPct = cfg['sales.discount.autoApprovedPercent'] as number;
    const allowNegative = cfg['sales.allowNegativeStock'] as boolean;

    // Build snapshot lines + enforce prescription / controlled-substance gating.
    const lineInputs: LineInput[] = [];
    for (const it of dto.items) {
      const m = meds.get(it.medicineId);
      if (!m) throw new BadRequestException({ errorCode: 'INVALID_MEDICINE', message: `Medicine ${it.medicineId} not found.` });
      if (m.prescriptionRequired && !it.prescriptionVerifiedBy) {
        throw new BadRequestException({ errorCode: 'PRESCRIPTION_NOT_VERIFIED', message: `${m.brandName ?? m.genericName} requires a verified prescription.` });
      }
      if (m.controlledSubstanceSchedule && !(dto.compliance ?? []).some((c) => c.medicineId === it.medicineId)) {
        throw new BadRequestException({ errorCode: 'COMPLIANCE_RECORD_MISSING', message: `${m.brandName ?? m.genericName} requires a controlled-substance compliance record.` });
      }
      lineInputs.push({ unitPrice: this.resolvePrice(user, it, m), quantity: it.quantity, discountAmount: it.discountAmount ?? 0, taxRatePercent: dec(m.taxRatePercent), taxInclusive: m.taxInclusive, unitCost: dec(m.costPrice) });
    }

    const { totals, lines } = computeCart(lineInputs);

    // Discount cap: cashiers need elevated approval beyond the auto-allowed %.
    const discountPct = totals.subTotal > 0 ? (totals.discountTotal / (totals.subTotal + totals.discountTotal)) * 100 : 0;
    if (!ELEVATED.includes(user.role) && discountPct > autoDiscountPct && !dto.discountApprovedBy) {
      throw new BadRequestException({ errorCode: 'DISCOUNT_NOT_APPROVED', message: `A ${discountPct.toFixed(1)}% discount exceeds the ${autoDiscountPct}% limit and needs manager approval.` });
    }

    // Payments must sum exactly to grand total (Decimal-precise).
    const paid = Math.round(dto.payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
    if (paid !== totals.grandTotal) {
      throw new BadRequestException({ errorCode: 'PAYMENT_MISMATCH', message: `Payments (${paid}) must equal the grand total (${totals.grandTotal}).` });
    }

    const sale = await this.prisma.$transaction(async (tx) => {
      // Lock the medicine rows for the transaction to catch concurrent sales of
      // the last unit (race → STOCK_CHANGED_SINCE_CHECK), never negative silently.
      const ids = dto.items.map((i) => i.medicineId);
      await tx.$queryRaw`SELECT id FROM "Medicine" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`;
      const fresh = await tx.medicine.findMany({ where: { id: { in: ids } }, select: { id: true, currentStock: true } });
      const stockOf = new Map(fresh.map((f) => [f.id, f.currentStock]));
      for (const it of dto.items) {
        if (!allowNegative && (stockOf.get(it.medicineId) ?? 0) < it.quantity) {
          throw new BadRequestException({ errorCode: 'STOCK_CHANGED_SINCE_CHECK', message: `Insufficient stock for ${meds.get(it.medicineId)?.brandName ?? meds.get(it.medicineId)?.genericName}. Available: ${stockOf.get(it.medicineId) ?? 0}.` });
        }
      }

      const saleNumber = await this.repo.nextSaleNumber(tx, user.pharmacyId);
      const created = await tx.sale.create({
        data: {
          pharmacyId: user.pharmacyId,
          branchId,
          saleNumber,
          cashierSessionId: session.id,
          cashierId: user.userId,
          customerId: dto.customerId,
          status: 'COMPLETED',
          subTotal: totals.subTotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          grandTotal: totals.grandTotal,
          totalCost: totals.totalCost,
          discountApprovedBy: dto.discountApprovedBy,
          notes: dto.notes,
          idempotencyKey: dto.idempotencyKey,
        },
      });

      // Per line: Module 6 FEFO allocation + Module 5 stock OUT (one call, one
      // transaction) → SaleItem (with the drawn batchId). Expired/recalled
      // batches are hard-excluded here — even a manual override can't pick one.
      for (let i = 0; i < dto.items.length; i++) {
        const it = dto.items[i];
        const alloc = await this.batches.allocateAndConsume(
          // Medicine rows were locked FOR UPDATE up front (see above) — skip re-locks.
          { pharmacyId: user.pharmacyId, branchId, medicineId: it.medicineId, requiredQuantity: it.quantity, referenceModule: 'SALE', referenceId: created.id, performedBy: user.userId, manualBatchId: it.batchId, unitCost: lineInputs[i].unitCost, medicineAlreadyLocked: true },
          tx,
        );
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: created.id,
            medicineId: it.medicineId,
            batchId: alloc[0]?.batchId ?? null,
            quantity: it.quantity,
            unitPrice: lineInputs[i].unitPrice,
            unitCost: lineInputs[i].unitCost ?? 0,
            discountAmount: lines[i].discount,
            taxRatePercent: lineInputs[i].taxRatePercent ?? 0,
            lineTotal: lines[i].lineTotal,
            prescriptionVerifiedBy: it.prescriptionVerifiedBy,
            prescriptionReference: it.prescriptionReference,
          },
        });

        // Compliance record for controlled/prescription lines.
        const comp = (dto.compliance ?? []).find((c) => c.medicineId === it.medicineId);
        if (comp) {
          await tx.saleComplianceRecord.create({
            data: {
              saleId: created.id,
              saleItemId: saleItem.id,
              type: comp.type,
              prescribingDoctor: comp.prescribingDoctor,
              patientName: comp.patientName,
              patientIdNumber: comp.patientIdNumber,
              quantityDispensed: comp.quantityDispensed,
              verifiedBy: it.prescriptionVerifiedBy ?? user.userId,
            },
          });
        }
      }

      // Payments (cash change computed from tendered).
      await tx.salePayment.createMany({
        data: dto.payments.map((p) => ({
          saleId: created.id,
          method: p.method,
          amount: p.amount,
          referenceNumber: p.referenceNumber,
          tenderedAmount: p.tenderedAmount,
          changeDue: p.method === 'CASH' && p.tenderedAmount != null ? Math.max(0, Math.round((p.tenderedAmount - p.amount) * 100) / 100) : null,
        })),
      });

      return created;
    });

    // Audit + event (non-transactional side effects).
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId, userId: user.userId, action: 'SALE_CREATED', entityType: 'SALE', entityId: sale.id, metadata: { saleNumber: sale.saleNumber, grandTotal: totals.grandTotal, itemCount: dto.items.length, methods: dto.payments.map((p) => p.method) } });
    if (dto.discountApprovedBy && dto.discountApprovedBy !== user.userId) {
      await this.audit.record({ pharmacyId: user.pharmacyId, branchId, userId: user.userId, action: 'DISCOUNT_APPROVED', entityType: 'SALE', entityId: sale.id, metadata: { approver: dto.discountApprovedBy, discountTotal: totals.discountTotal } });
    }
    for (const it of dto.items.filter((i) => i.batchId)) {
      await this.audit.record({ pharmacyId: user.pharmacyId, branchId, userId: user.userId, action: 'MANUAL_BATCH_OVERRIDE_USED', entityType: 'SALE', entityId: sale.id, metadata: { medicineId: it.medicineId, batchId: it.batchId } });
    }
    if ((dto.compliance ?? []).length) {
      await this.audit.record({ pharmacyId: user.pharmacyId, branchId, userId: user.userId, action: 'COMPLIANCE_RECORD_SUBMITTED', entityType: 'SALE', entityId: sale.id, metadata: { count: dto.compliance!.length } });
    }
    this.events.saleCreated({ pharmacyId: user.pharmacyId, branchId, saleId: sale.id, grandTotal: totals.grandTotal, medicineIds: dto.items.map((i) => i.medicineId), actorId: user.userId });

    return this.getById(user, sale.id);
  }

  // -------------------------------------------------------------------------
  // Void (same-day, reverses stock + batches + compliance)
  // -------------------------------------------------------------------------
  async voidSale(user: AuthenticatedUser, id: string, dto: VoidSaleDto) {
    const sale = await this.repo.saleById(user.pharmacyId, id);
    if (!sale) throw new NotFoundException({ errorCode: 'SALE_NOT_FOUND', message: 'Sale not found' });
    if (sale.status !== 'COMPLETED') throw new BadRequestException({ errorCode: 'NOT_VOIDABLE', message: `A ${sale.status} sale cannot be voided.` });
    const ageDays = (Date.now() - sale.saleDate.getTime()) / 86400000;
    const voidWindowDays = await this.settings.get<number>('sales.voidWindowDays', { pharmacyId: sale.pharmacyId, branchId: sale.branchId });
    if (ageDays > voidWindowDays) throw new BadRequestException({ errorCode: 'VOID_WINDOW_EXPIRED', message: 'Past the void window — process this as a return (Module 10).' });

    await this.prisma.$transaction(async (tx) => {
      // Module 6 restores each batch's quantity + records the offsetting Module 5
      // ledger IN (original OUT preserved), all in this transaction.
      await this.batches.reverseConsumption(
        { pharmacyId: sale.pharmacyId, branchId: sale.branchId, items: sale.items.map((item) => ({ medicineId: item.medicineId, batchId: item.batchId, quantity: item.quantity })), referenceModule: 'SALE', referenceId: id, performedBy: user.userId, notes: 'Sale void reversal' },
        tx,
      );
      await tx.saleComplianceRecord.updateMany({ where: { saleId: id }, data: { isVoided: true } });
      await tx.sale.update({ where: { id }, data: { status: 'VOIDED', voidedBy: user.userId, voidedAt: new Date(), voidReason: dto.reason } });
    });

    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: sale.branchId, userId: user.userId, action: 'SALE_VOIDED', entityType: 'SALE', entityId: id, metadata: { reason: dto.reason, reversedItems: sale.items.length } });
    this.events.saleVoided({ pharmacyId: user.pharmacyId, branchId: sale.branchId, saleId: id, actorId: user.userId });
    return { id, status: 'VOIDED' };
  }

  // -------------------------------------------------------------------------
  // Narrow status transition owned by Module 4, called by Module 10 (Returns).
  // A return NEVER edits Sale/SaleItem figures — only this status field moves
  // (COMPLETED → PARTIALLY_RETURNED → FULLY_RETURNED), preserving the sale's
  // immutable historical totals. Runs inside the return's transaction so the
  // whole operation is atomic.
  // -------------------------------------------------------------------------
  async markReturnStatus(tx: Prisma.TransactionClient, pharmacyId: string, saleId: string, fullyReturned: boolean): Promise<void> {
    const sale = await tx.sale.findFirst({ where: { id: saleId, pharmacyId }, select: { status: true } });
    if (!sale) throw new NotFoundException({ errorCode: 'SALE_NOT_FOUND', message: 'Original sale not found' });
    if (sale.status === 'VOIDED') throw new BadRequestException({ errorCode: 'SALE_VOIDED', message: 'A voided sale cannot be returned.' });
    if (sale.status === 'FULLY_RETURNED') throw new BadRequestException({ errorCode: 'ALREADY_FULLY_RETURNED', message: 'This sale has already been fully returned.' });
    await tx.sale.update({ where: { id: saleId }, data: { status: fullyReturned ? 'FULLY_RETURNED' : 'PARTIALLY_RETURNED' } });
  }

  // -------------------------------------------------------------------------
  // Queries (cashier auto-scoped to own sales)
  // -------------------------------------------------------------------------
  async list(user: AuthenticatedUser, q: { page?: number; limit?: number; search?: string; cashierId?: string; customerId?: string; status?: string; paymentMethod?: string; dateFrom?: string; dateTo?: string; branchId?: string }) {
    const branchId = this.branch(user, q.branchId);
    const cashierId = user.role === 'cashier' ? user.userId : q.cashierId; // cashiers see only their own
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const { total, rows } = await this.repo.listSales(user.pharmacyId, branchId, { page, limit, search: q.search, cashierId, customerId: q.customerId, status: q.status, paymentMethod: q.paymentMethod, dateFrom: q.dateFrom, dateTo: q.dateTo });
    return {
      page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)),
      data: rows.map((s) => ({ id: s.id, saleNumber: s.saleNumber, saleDate: s.saleDate.toISOString(), status: s.status, cashierId: s.cashierId, customerId: s.customerId, itemCount: s._count.items, grandTotal: dec(s.grandTotal), methods: [...new Set(s.payments.map((p) => p.method))] })),
    };
  }

  async getById(user: AuthenticatedUser, id: string) {
    const sale = await this.repo.saleById(user.pharmacyId, id);
    if (!sale) throw new NotFoundException({ errorCode: 'SALE_NOT_FOUND', message: 'Sale not found' });
    if (user.role === 'cashier' && sale.cashierId !== user.userId) throw new ForbiddenException({ errorCode: 'NOT_OWN_SALE', message: 'You can only view your own sales.' });
    const medIds = [...new Set(sale.items.map((i) => i.medicineId))];
    const meds = await this.prisma.medicine.findMany({ where: { id: { in: medIds } }, select: { id: true, genericName: true, brandName: true, sku: true } });
    const nameOf = new Map(meds.map((m) => [m.id, { name: m.brandName ?? m.genericName, sku: m.sku }]));
    return {
      id: sale.id,
      saleNumber: sale.saleNumber,
      saleDate: sale.saleDate.toISOString(),
      status: sale.status,
      cashierId: sale.cashierId,
      customerId: sale.customerId,
      subTotal: dec(sale.subTotal),
      discountTotal: dec(sale.discountTotal),
      taxTotal: dec(sale.taxTotal),
      grandTotal: dec(sale.grandTotal),
      totalCost: dec(sale.totalCost),
      voidReason: sale.voidReason,
      items: sale.items.map((i) => ({ id: i.id, medicineId: i.medicineId, name: nameOf.get(i.medicineId)?.name ?? i.medicineId, sku: nameOf.get(i.medicineId)?.sku ?? null, quantity: i.quantity, unitPrice: dec(i.unitPrice), discountAmount: dec(i.discountAmount), taxRatePercent: dec(i.taxRatePercent), lineTotal: dec(i.lineTotal), batchId: i.batchId })),
      payments: sale.payments.map((p) => ({ method: p.method, amount: dec(p.amount), referenceNumber: p.referenceNumber, tenderedAmount: p.tenderedAmount != null ? dec(p.tenderedAmount) : null, changeDue: p.changeDue != null ? dec(p.changeDue) : null })),
      complianceRecords: sale.complianceRecords.map((c) => ({ id: c.id, type: c.type, prescribingDoctor: c.prescribingDoctor, patientName: c.patientName, quantityDispensed: c.quantityDispensed, isVoided: c.isVoided })),
    };
  }

  // -------------------------------------------------------------------------
  // Parked sales
  // -------------------------------------------------------------------------
  async park(user: AuthenticatedUser, dto: ParkSaleDto, branchId?: string) {
    const scope = this.branch(user, branchId);
    const parked = await this.prisma.parkedSale.create({ data: { pharmacyId: user.pharmacyId, branchId: scope, cashierId: user.userId, label: dto.label, cartSnapshot: dto.cartSnapshot as Prisma.InputJsonValue } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: scope, userId: user.userId, action: 'SALE_PARKED', entityType: 'PARKED_SALE', entityId: parked.id, metadata: { label: dto.label } });
    return { id: parked.id, label: parked.label, createdAt: parked.createdAt.toISOString() };
  }

  async listParked(user: AuthenticatedUser, branchId?: string) {
    const scope = this.branch(user, branchId);
    const rows = await this.repo.parkedSales(user.pharmacyId, scope, user.userId);
    return rows.map((p) => ({ id: p.id, label: p.label, cartSnapshot: p.cartSnapshot, createdAt: p.createdAt.toISOString() }));
  }

  async discardParked(user: AuthenticatedUser, id: string) {
    const parked = await this.prisma.parkedSale.findFirst({ where: { id, pharmacyId: user.pharmacyId, cashierId: user.userId } });
    if (!parked) throw new NotFoundException({ errorCode: 'PARKED_NOT_FOUND', message: 'Parked sale not found' });
    await this.prisma.parkedSale.delete({ where: { id } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: parked.branchId, userId: user.userId, action: 'PARKED_SALE_DISCARDED', entityType: 'PARKED_SALE', entityId: id });
    return { id, discarded: true };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  private async loadMedicines(pharmacyId: string, ids: string[]) {
    const meds = await this.prisma.medicine.findMany({
      where: { pharmacyId, id: { in: [...new Set(ids)] } },
      select: { id: true, genericName: true, brandName: true, sellingPrice: true, costPrice: true, taxRatePercent: true, taxInclusive: true, currentStock: true, prescriptionRequired: true, controlledSubstanceSchedule: true, status: true },
    });
    return new Map(meds.map((m) => [m.id, m]));
  }

  private resolvePrice(user: AuthenticatedUser, it: { unitPrice?: number }, m: { sellingPrice: Prisma.Decimal }): number {
    // Line price override is an elevated, audited action; cashiers get list price.
    if (it.unitPrice !== undefined && ELEVATED.includes(user.role)) return it.unitPrice;
    return dec(m.sellingPrice);
  }

  /**
   * Step-up authorization for an over-limit discount: the elevated approver
   * enters their OWN credentials (not the cashier's) — verified against Supabase
   * Auth — and we return their authenticated identity to attach to the sale.
   */
  async discountApproval(dto: { approverEmail: string; approverPassword: string }) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new BadRequestException({ errorCode: 'AUTH_NOT_CONFIGURED', message: 'Auth is not configured.' });
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: dto.approverEmail, password: dto.approverPassword }),
    });
    const j = (await res.json()) as { access_token?: string; user?: { id: string; app_metadata?: { role?: string } } };
    if (!j.access_token || !j.user) throw new ForbiddenException({ errorCode: 'APPROVAL_FAILED', message: 'Invalid approver credentials.' });
    const role = j.user.app_metadata?.role;
    if (!role || !ELEVATED.includes(role)) throw new ForbiddenException({ errorCode: 'NOT_AUTHORIZED_TO_APPROVE', message: 'That user is not allowed to approve discounts.' });
    return { approverId: j.user.id, role };
  }
}
