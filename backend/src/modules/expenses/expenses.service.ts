import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Expense, ExpenseCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { SettingsService } from '../settings/settings.service';
import { ExpensesRepository } from './expenses.repository';
import { ExpenseCategoriesService } from './expense-categories.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { RecordExpensePaymentDto } from './dto/record-payment.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import { needsApproval } from './expense-threshold';
import { ExpenseView } from './interfaces/expense.interface';
import { DEFAULT_CATEGORY_LABELS } from './default-categories';

export const dec = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : typeof v === 'number' ? v : v.toNumber());
const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ExpensesRepository,
    private readonly categories: ExpenseCategoriesService,
    private readonly settings: SettingsService,
    private readonly audit: AuditLogService,
    private readonly events: EventEmitter2,
  ) {}

  private resolveBranch(user: AuthenticatedUser, requested?: string): string {
    const branchId = requested ?? user.branchId;
    if (!user.accessibleBranchIds.includes(branchId)) {
      throw new ForbiddenException({ errorCode: 'BRANCH_ACCESS_DENIED', message: `You do not have access to branch ${branchId}` });
    }
    return branchId;
  }

  private async approvalConfig(pharmacyId: string, branchId: string) {
    const cfg = await this.settings.getMany(['expenses.approval.thresholdAmount', 'expenses.approval.deviationPercent'], { pharmacyId, branchId });
    return { threshold: Number(cfg['expenses.approval.thresholdAmount'] ?? 25000), deviationPercent: Number(cfg['expenses.approval.deviationPercent'] ?? 25) };
  }

  // --- Create --------------------------------------------------------------
  async create(user: AuthenticatedUser, dto: CreateExpenseDto): Promise<ExpenseView> {
    const branchId = this.resolveBranch(user, dto.branchId);
    await this.categories.ensureDefaults(user.pharmacyId);
    const category = await this.categories.requireActive(user.pharmacyId, dto.categoryId);

    const incurredDate = dto.incurredDate ? new Date(dto.incurredDate) : new Date();
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;

    const { threshold, deviationPercent } = await this.approvalConfig(user.pharmacyId, branchId);
    // One-off expense → no template default to deviate from; flat threshold only.
    const requiresApproval = needsApproval({ amount: dto.amount, threshold, defaultAmount: null, deviationPercent });
    const approvalStatus = requiresApproval ? 'PENDING_APPROVAL' : 'NOT_REQUIRED';

    const created = await this.prisma.$transaction(async (tx) => {
      const expenseNumber = await this.repo.nextNumber(tx, user.pharmacyId);
      return tx.expense.create({
        data: {
          pharmacyId: user.pharmacyId,
          branchId,
          expenseNumber,
          categoryId: dto.categoryId,
          payeeName: dto.payeeName.trim(),
          amount: dto.amount,
          incurredDate,
          dueDate,
          paymentStatus: 'UNPAID',
          amountPaid: 0,
          approvalStatus,
          receiptUrl: dto.receiptUrl,
          notes: dto.notes,
          createdBy: user.userId,
        },
        include: { category: true },
      });
    });

    await this.audit.record({
      pharmacyId: user.pharmacyId, branchId, userId: user.userId,
      action: 'EXPENSE_CREATED', entityType: 'EXPENSE', entityId: created.id,
      metadata: { expenseNumber: created.expenseNumber, category: category.name, amount: dto.amount, payee: dto.payeeName, approvalStatus },
    });
    this.events.emit('expense.created', { pharmacyId: user.pharmacyId, branchId });
    return this.serialize(created, category);
  }

  // --- Update (pre-approval only) -----------------------------------------
  async update(user: AuthenticatedUser, id: string, dto: UpdateExpenseDto): Promise<ExpenseView> {
    const existing = await this.repo.findById(user.pharmacyId, id);
    if (!existing) throw new NotFoundException({ errorCode: 'EXPENSE_NOT_FOUND', message: 'Expense not found.' });
    if (existing.approvalStatus === 'APPROVED' || existing.approvalStatus === 'REJECTED') {
      throw new BadRequestException({ errorCode: 'NOT_EDITABLE', message: `A ${existing.approvalStatus.toLowerCase()} expense can no longer be edited.` });
    }
    if (dec(existing.amountPaid) > 0) {
      throw new BadRequestException({ errorCode: 'HAS_PAYMENTS', message: 'An expense with recorded payments cannot be edited.' });
    }

    // Validate a category change (throws if not found / inactive).
    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      await this.categories.requireActive(user.pharmacyId, dto.categoryId);
    }

    const newAmount = dto.amount ?? dec(existing.amount);
    // Re-route through approval when the (possibly new) amount now warrants it —
    // for generated instances, compare against the template default (deviation).
    const { threshold, deviationPercent } = await this.approvalConfig(user.pharmacyId, existing.branchId);
    let defaultAmount: number | null = null;
    if (existing.generatedFromTemplateId) {
      const tpl = await this.prisma.recurringExpenseTemplate.findUnique({ where: { id: existing.generatedFromTemplateId }, select: { defaultAmount: true } });
      defaultAmount = tpl?.defaultAmount != null ? dec(tpl.defaultAmount) : null;
    }
    const approvalStatus = needsApproval({ amount: newAmount, threshold, defaultAmount, deviationPercent }) ? 'PENDING_APPROVAL' : 'NOT_REQUIRED';

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
        ...(dto.payeeName !== undefined ? { payeeName: dto.payeeName.trim() } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.incurredDate ? { incurredDate: new Date(dto.incurredDate) } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
        ...(dto.receiptUrl !== undefined ? { receiptUrl: dto.receiptUrl } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        approvalStatus,
      },
      include: { category: true },
    });

    await this.audit.record({
      pharmacyId: user.pharmacyId, branchId: updated.branchId, userId: user.userId,
      action: 'EXPENSE_UPDATED', entityType: 'EXPENSE', entityId: id,
      metadata: { expenseNumber: updated.expenseNumber, amount: dec(updated.amount), approvalStatus },
    });
    this.events.emit('expense.created', { pharmacyId: user.pharmacyId, branchId: updated.branchId });
    return this.serialize(updated, updated.category);
  }

  // --- Approve / Reject ----------------------------------------------------
  async approve(user: AuthenticatedUser, id: string): Promise<ExpenseView> {
    const existing = await this.repo.findById(user.pharmacyId, id);
    if (!existing) throw new NotFoundException({ errorCode: 'EXPENSE_NOT_FOUND', message: 'Expense not found.' });
    if (existing.approvalStatus !== 'PENDING_APPROVAL') {
      throw new BadRequestException({ errorCode: 'NOT_PENDING', message: `Expense is ${existing.approvalStatus}, not pending approval.` });
    }
    const updated = await this.prisma.expense.update({ where: { id }, data: { approvalStatus: 'APPROVED', approvedBy: user.userId, approvedAt: new Date(), rejectedReason: null }, include: { category: true } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: existing.branchId, userId: user.userId, action: 'EXPENSE_APPROVED', entityType: 'EXPENSE', entityId: id, metadata: { expenseNumber: existing.expenseNumber, amount: dec(existing.amount) } });
    return this.serialize(updated, updated.category);
  }

  async reject(user: AuthenticatedUser, id: string, reason: string): Promise<ExpenseView> {
    const existing = await this.repo.findById(user.pharmacyId, id);
    if (!existing) throw new NotFoundException({ errorCode: 'EXPENSE_NOT_FOUND', message: 'Expense not found.' });
    if (existing.approvalStatus !== 'PENDING_APPROVAL') {
      throw new BadRequestException({ errorCode: 'NOT_PENDING', message: `Expense is ${existing.approvalStatus}, not pending approval.` });
    }
    const updated = await this.prisma.expense.update({ where: { id }, data: { approvalStatus: 'REJECTED', rejectedReason: reason, approvedBy: user.userId, approvedAt: new Date() }, include: { category: true } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: existing.branchId, userId: user.userId, action: 'EXPENSE_REJECTED', entityType: 'EXPENSE', entityId: id, metadata: { expenseNumber: existing.expenseNumber, reason } });
    return this.serialize(updated, updated.category);
  }

  // --- Payments ------------------------------------------------------------
  async recordPayment(user: AuthenticatedUser, id: string, dto: RecordExpensePaymentDto) {
    const existing = await this.repo.findById(user.pharmacyId, id);
    if (!existing) throw new NotFoundException({ errorCode: 'EXPENSE_NOT_FOUND', message: 'Expense not found.' });
    // Ordering rule (spec §10): a pending-approval expense isn't payable yet.
    if (existing.approvalStatus === 'PENDING_APPROVAL') {
      throw new BadRequestException({ errorCode: 'APPROVAL_REQUIRED', message: 'This expense must be approved before a payment can be recorded.' });
    }
    if (existing.approvalStatus === 'REJECTED') {
      throw new BadRequestException({ errorCode: 'EXPENSE_REJECTED', message: 'A rejected expense cannot be paid.' });
    }

    const outstanding = dec(existing.amount) - dec(existing.amountPaid);
    if (dto.amount > outstanding + 0.001) {
      throw new BadRequestException({ errorCode: 'OVERPAYMENT', message: `Payment exceeds the outstanding balance of ${outstanding.toFixed(2)}.` });
    }
    const newPaid = round2(dec(existing.amountPaid) + dto.amount);
    const paymentStatus = newPaid >= dec(existing.amount) - 0.001 ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

    const payment = await this.prisma.$transaction(async (tx) => {
      const p = await tx.expensePayment.create({
        data: {
          pharmacyId: user.pharmacyId,
          expenseId: id,
          amount: dto.amount,
          method: dto.method,
          referenceNumber: dto.referenceNumber,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          notes: dto.notes,
          recordedBy: user.userId,
        },
      });
      await tx.expense.update({ where: { id }, data: { amountPaid: newPaid, paymentStatus } });
      return p;
    });

    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: existing.branchId, userId: user.userId, action: 'EXPENSE_PAYMENT_RECORDED', entityType: 'EXPENSE', entityId: id, metadata: { expenseNumber: existing.expenseNumber, amount: dto.amount, method: dto.method, paymentStatus } });
    this.events.emit('expense.created', { pharmacyId: user.pharmacyId, branchId: existing.branchId });
    return { id: payment.id, amountPaid: newPaid, paymentStatus, outstanding: round2(dec(existing.amount) - newPaid) };
  }

  // --- Queries -------------------------------------------------------------
  async list(user: AuthenticatedUser, q: QueryExpensesDto) {
    const { total, rows, page, limit } = await this.repo.list(user.pharmacyId, q, user.accessibleBranchIds);
    return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), data: rows.map((r) => this.serialize(r, r.category)) };
  }

  async detail(user: AuthenticatedUser, id: string) {
    const expense = await this.repo.findById(user.pharmacyId, id);
    if (!expense) throw new NotFoundException({ errorCode: 'EXPENSE_NOT_FOUND', message: 'Expense not found.' });
    const payments = await this.prisma.expensePayment.findMany({ where: { expenseId: id }, orderBy: { paymentDate: 'desc' } });
    return {
      ...this.serialize(expense, expense.category),
      payments: payments.map((p) => ({ id: p.id, amount: dec(p.amount), method: p.method, referenceNumber: p.referenceNumber, paymentDate: p.paymentDate.toISOString(), notes: p.notes, recordedBy: p.recordedBy })),
    };
  }

  /** Category breakdown for a period — feeds Dashboard's Total Expenses KPI + Reports. */
  async summary(user: AuthenticatedUser, dateFrom?: string, dateTo?: string, branchId?: string) {
    const now = new Date();
    const from = dateFrom ? new Date(dateFrom) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = dateTo ? new Date(dateTo) : now;
    if (branchId) this.resolveBranch(user, branchId);
    const grouped = await this.repo.summary(user.pharmacyId, from, to, branchId);
    const cats = await this.prisma.expenseCategory.findMany({ where: { pharmacyId: user.pharmacyId }, select: { id: true, name: true } });
    const nameOf = new Map(cats.map((c) => [c.id, c.name]));
    const byCategory = grouped
      .map((g) => ({ categoryId: g.categoryId, categoryName: nameOf.get(g.categoryId) ?? g.categoryId, label: DEFAULT_CATEGORY_LABELS[nameOf.get(g.categoryId) ?? ''] ?? nameOf.get(g.categoryId) ?? g.categoryId, total: round2(dec(g._sum.amount)), count: g._count._all }))
      .sort((a, b) => b.total - a.total);
    return { dateFrom: from.toISOString(), dateTo: to.toISOString(), total: round2(byCategory.reduce((s, c) => s + c.total, 0)), count: byCategory.reduce((s, c) => s + c.count, 0), byCategory };
  }

  // --- Serialization -------------------------------------------------------
  private serialize(e: Expense, category?: ExpenseCategory | null): ExpenseView {
    const amount = dec(e.amount);
    const amountPaid = dec(e.amountPaid);
    const isOverdue = e.paymentStatus !== 'PAID' && e.approvalStatus !== 'REJECTED' && !!e.dueDate && e.dueDate.getTime() < Date.now();
    return {
      id: e.id,
      expenseNumber: e.expenseNumber,
      categoryId: e.categoryId,
      categoryName: category?.name ?? e.categoryId,
      branchId: e.branchId,
      payeeName: e.payeeName,
      amount,
      amountPaid,
      outstanding: round2(amount - amountPaid),
      incurredDate: e.incurredDate.toISOString(),
      dueDate: e.dueDate?.toISOString() ?? null,
      paymentStatus: e.paymentStatus,
      isOverdue,
      approvalStatus: e.approvalStatus,
      approvedBy: e.approvedBy,
      approvedAt: e.approvedAt?.toISOString() ?? null,
      rejectedReason: e.rejectedReason,
      isRecurringGenerated: !!e.generatedFromTemplateId,
      generatedFromTemplateId: e.generatedFromTemplateId,
      receiptUrl: e.receiptUrl,
      notes: e.notes,
      createdBy: e.createdBy,
      createdAt: e.createdAt.toISOString(),
    };
  }
}
