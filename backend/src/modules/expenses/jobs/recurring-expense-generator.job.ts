import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, RecurringExpenseTemplate } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.interface';
import { ExpensesRepository } from '../expenses.repository';
import { duePeriodFor } from '../recurrence';

const dec = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : typeof v === 'number' ? v : v.toNumber());

export interface GenerationResult {
  processed: number;
  generated: number;
  skipped: number; // already generated for this period (idempotent no-op)
  failed: number; // isolated per-template failures (spec §12)
}

/**
 * Module 13 recurring-expense generator (spec §2.2 / §3 / §8).
 *
 * IDEMPOTENT BY CONSTRUCTION: for each active template it computes the period due
 * as of `asOf` (pure `duePeriodFor`), then creates ONE `Expense` tagged with
 * (generatedFromTemplateId, periodKey). A DB unique index on that pair means a
 * re-run — or two overlapping runs — can never create a duplicate: the second
 * insert hits P2002 and is counted as `skipped`, not `failed`.
 *
 * FAILURE ISOLATION: a bad template never blocks the batch — each is wrapped in
 * its own try/catch and logged.
 */
@Injectable()
export class RecurringExpenseGeneratorJob {
  private readonly logger = new Logger('RecurringExpenseGenerator');

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ExpensesRepository,
    private readonly audit: AuditLogService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Run generation for every active template (optionally scoped to one pharmacy).
   * `asOf` is injectable so tests drive it deterministically without touching the clock.
   */
  async run(asOf: Date = new Date(), pharmacyId?: string): Promise<GenerationResult> {
    const templates = await this.prisma.recurringExpenseTemplate.findMany({
      where: { isActive: true, ...(pharmacyId ? { pharmacyId } : {}), OR: [{ endedAt: null }, { endedAt: { gt: asOf } }] },
    });
    const result: GenerationResult = { processed: 0, generated: 0, skipped: 0, failed: 0 };

    for (const t of templates) {
      result.processed++;
      try {
        const due = duePeriodFor(t, asOf);
        if (!due) continue;
        // Fast idempotency short-circuit before hitting the unique index.
        if (t.lastGeneratedPeriod === due.periodKey) {
          result.skipped++;
          continue;
        }
        const outcome = await this.generateOne(t, due.periodKey, due.dueDate);
        if (outcome === 'generated') result.generated++;
        else result.skipped++;
      } catch (err) {
        result.failed++;
        this.logger.error(`Template ${t.id} generation failed (isolated): ${(err as Error).message}`);
      }
    }

    if (result.generated > 0) this.logger.log(`Generated ${result.generated} recurring expense(s) as of ${asOf.toISOString()} (${result.skipped} already present).`);
    return result;
  }

  private async generateOne(t: RecurringExpenseTemplate, periodKey: string, dueDate: Date): Promise<'generated' | 'skipped'> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const expenseNumber = await this.repo.nextNumber(tx, t.pharmacyId);
        const expense = await tx.expense.create({
          data: {
            pharmacyId: t.pharmacyId,
            branchId: t.branchId,
            expenseNumber,
            categoryId: t.categoryId,
            payeeName: t.payeeName,
            // Reminder-only templates (variable utilities) generate at 0 — the
            // accountant fills in the real amount for the period (spec §4).
            amount: t.defaultAmount != null ? dec(t.defaultAmount) : 0,
            incurredDate: dueDate,
            dueDate,
            paymentStatus: 'UNPAID',
            // Generated == the expected template default → routine, no approval.
            approvalStatus: 'NOT_REQUIRED',
            generatedFromTemplateId: t.id,
            periodKey,
            createdBy: t.createdBy,
          },
        });
        await tx.recurringExpenseTemplate.update({ where: { id: t.id }, data: { lastGeneratedPeriod: periodKey } });
        return expense;
      });

      await this.audit.record({
        pharmacyId: t.pharmacyId, branchId: t.branchId, userId: t.createdBy,
        action: 'RECURRING_EXPENSE_AUTO_GENERATED', entityType: 'EXPENSE', entityId: created.id,
        metadata: { expenseNumber: created.expenseNumber, templateId: t.id, period: periodKey, payee: t.payeeName },
      });
      this.events.emit('expense.created', { pharmacyId: t.pharmacyId, branchId: t.branchId });
      return 'generated';
    } catch (err) {
      // Unique (generatedFromTemplateId, periodKey) collision → another run already
      // generated this period. Treat as an idempotent no-op, not a failure.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        await this.prisma.recurringExpenseTemplate.update({ where: { id: t.id }, data: { lastGeneratedPeriod: periodKey } }).catch(() => undefined);
        return 'skipped';
      }
      throw err;
    }
  }
}
