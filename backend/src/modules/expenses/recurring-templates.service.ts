import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Prisma, RecurringExpenseTemplate } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ExpenseCategoriesService } from './expense-categories.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/create-template.dto';
import { RecurringExpenseGeneratorJob } from './jobs/recurring-expense-generator.job';
import { duePeriodFor } from './recurrence';

const dec = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : typeof v === 'number' ? v : v.toNumber());
const DAY_MS = 86_400_000;

@Injectable()
export class RecurringTemplatesService implements OnModuleInit {
  private readonly logger = new Logger('RecurringTemplates');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: ExpenseCategoriesService,
    private readonly generator: RecurringExpenseGeneratorJob,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Self-contained daily scheduler (no external cron dependency). A once-a-day
   * tick calls the idempotent generator; the idempotency guarantees make a
   * missed/duplicated tick harmless. Disabled in tests and when
   * EXPENSES_GENERATOR_ENABLED=false. A production deployment can instead point
   * an external scheduler at POST /api/recurring-expense-templates/run-generation.
   */
  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.EXPENSES_GENERATOR_ENABLED === 'false') return;
    // Kick once shortly after boot, then every 24h.
    setTimeout(() => void this.tick(), 30_000).unref?.();
    this.timer = setInterval(() => void this.tick(), DAY_MS);
    this.timer.unref?.();
  }

  private async tick(): Promise<void> {
    try {
      const r = await this.generator.run(new Date());
      if (r.generated > 0) this.logger.log(`Scheduled generation: ${r.generated} created, ${r.skipped} already present.`);
    } catch (err) {
      this.logger.error(`Scheduled generation failed: ${(err as Error).message}`);
    }
  }

  private resolveBranch(user: AuthenticatedUser, requested?: string): string {
    const branchId = requested ?? user.branchId;
    if (!user.accessibleBranchIds.includes(branchId)) {
      throw new BadRequestException({ errorCode: 'BRANCH_ACCESS_DENIED', message: `You do not have access to branch ${branchId}` });
    }
    return branchId;
  }

  async create(user: AuthenticatedUser, dto: CreateTemplateDto) {
    const branchId = this.resolveBranch(user, dto.branchId);
    await this.categories.requireActive(user.pharmacyId, dto.categoryId);
    const tpl = await this.prisma.recurringExpenseTemplate.create({
      data: {
        pharmacyId: user.pharmacyId,
        branchId,
        categoryId: dto.categoryId,
        payeeName: dto.payeeName.trim(),
        defaultAmount: dto.defaultAmount ?? null,
        recurrenceFrequency: dto.recurrenceFrequency,
        dayOfPeriod: dto.dayOfPeriod,
        notes: dto.notes,
        createdBy: user.userId,
      },
    });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId, userId: user.userId, action: 'RECURRING_TEMPLATE_CREATED', entityType: 'RECURRING_EXPENSE_TEMPLATE', entityId: tpl.id, metadata: { payee: tpl.payeeName, frequency: tpl.recurrenceFrequency, dayOfPeriod: tpl.dayOfPeriod } });
    return this.serialize(tpl);
  }

  async list(user: AuthenticatedUser, includeInactive = true) {
    const rows = await this.prisma.recurringExpenseTemplate.findMany({
      where: { pharmacyId: user.pharmacyId, branchId: { in: user.accessibleBranchIds }, ...(includeInactive ? {} : { isActive: true }) },
      include: { category: true },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((t) => this.serialize(t, (t as RecurringExpenseTemplate & { category?: { name: string } }).category?.name));
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateTemplateDto) {
    const tpl = await this.prisma.recurringExpenseTemplate.findFirst({ where: { id, pharmacyId: user.pharmacyId } });
    if (!tpl) throw new NotFoundException({ errorCode: 'TEMPLATE_NOT_FOUND', message: 'Template not found.' });
    if (dto.categoryId) await this.categories.requireActive(user.pharmacyId, dto.categoryId);
    const updated = await this.prisma.recurringExpenseTemplate.update({
      where: { id },
      data: {
        ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
        ...(dto.payeeName !== undefined ? { payeeName: dto.payeeName.trim() } : {}),
        ...(dto.defaultAmount !== undefined ? { defaultAmount: dto.defaultAmount } : {}),
        ...(dto.recurrenceFrequency ? { recurrenceFrequency: dto.recurrenceFrequency } : {}),
        ...(dto.dayOfPeriod !== undefined ? { dayOfPeriod: dto.dayOfPeriod } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: tpl.branchId, userId: user.userId, action: 'RECURRING_TEMPLATE_UPDATED', entityType: 'RECURRING_EXPENSE_TEMPLATE', entityId: id, metadata: { payee: updated.payeeName } });
    return this.serialize(updated);
  }

  /** Pause/resume without deleting history (spec §2.2 / §11). */
  async setActive(user: AuthenticatedUser, id: string, isActive: boolean) {
    const tpl = await this.prisma.recurringExpenseTemplate.findFirst({ where: { id, pharmacyId: user.pharmacyId } });
    if (!tpl) throw new NotFoundException({ errorCode: 'TEMPLATE_NOT_FOUND', message: 'Template not found.' });
    const updated = await this.prisma.recurringExpenseTemplate.update({ where: { id }, data: { isActive } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: tpl.branchId, userId: user.userId, action: 'RECURRING_TEMPLATE_UPDATED', entityType: 'RECURRING_EXPENSE_TEMPLATE', entityId: id, metadata: { isActive } });
    return this.serialize(updated);
  }

  /** End a template — stops future generation; historical records are untouched (spec §11). */
  async end(user: AuthenticatedUser, id: string) {
    const tpl = await this.prisma.recurringExpenseTemplate.findFirst({ where: { id, pharmacyId: user.pharmacyId } });
    if (!tpl) throw new NotFoundException({ errorCode: 'TEMPLATE_NOT_FOUND', message: 'Template not found.' });
    const updated = await this.prisma.recurringExpenseTemplate.update({ where: { id }, data: { isActive: false, endedAt: new Date() } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: tpl.branchId, userId: user.userId, action: 'RECURRING_TEMPLATE_ENDED', entityType: 'RECURRING_EXPENSE_TEMPLATE', entityId: id, metadata: { payee: tpl.payeeName } });
    return this.serialize(updated);
  }

  /** Manual trigger (admin) — also the seam an external scheduler can call. */
  async runGeneration(user: AuthenticatedUser) {
    return this.generator.run(new Date(), user.pharmacyId);
  }

  /**
   * The next date this template will generate an expense (upcoming-view / cash-flow).
   * Scans forward day-by-day (bounded) for the first period whose due date is in
   * the future and hasn't already been generated.
   */
  private nextGenerationDate(t: RecurringExpenseTemplate): string | null {
    if (!t.isActive || (t.endedAt && t.endedAt.getTime() <= Date.now())) return null;
    const now = new Date();
    for (let i = 0; i <= 400; i++) {
      const probe = new Date(now.getTime() + i * DAY_MS);
      const due = duePeriodFor(t, probe);
      if (due && due.dueDate.getTime() >= now.getTime() && t.lastGeneratedPeriod !== due.periodKey) {
        return due.dueDate.toISOString();
      }
    }
    return null;
  }

  private serialize(t: RecurringExpenseTemplate, categoryName?: string) {
    return {
      id: t.id,
      branchId: t.branchId,
      categoryId: t.categoryId,
      categoryName: categoryName ?? null,
      payeeName: t.payeeName,
      defaultAmount: t.defaultAmount != null ? dec(t.defaultAmount) : null,
      recurrenceFrequency: t.recurrenceFrequency,
      dayOfPeriod: t.dayOfPeriod,
      notes: t.notes,
      isActive: t.isActive,
      startedAt: t.startedAt.toISOString(),
      endedAt: t.endedAt?.toISOString() ?? null,
      lastGeneratedPeriod: t.lastGeneratedPeriod,
      nextGenerationDate: this.nextGenerationDate(t),
      createdAt: t.createdAt.toISOString(),
    };
  }
}
