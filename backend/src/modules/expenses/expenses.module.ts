import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { RecurringTemplatesController } from './recurring-templates.controller';
import { ExpensesService } from './expenses.service';
import { ExpensesRepository } from './expenses.repository';
import { ExpenseCategoriesService } from './expense-categories.service';
import { RecurringTemplatesService } from './recurring-templates.service';
import { PayablesService } from './payables.service';
import { RecurringExpenseGeneratorJob } from './jobs/recurring-expense-generator.job';

/**
 * Module 13 — Expenses Management. Authoritative source of non-inventory
 * operating-cost data. Depends on the @Global SettingsService (Module 18,
 * approval threshold), AuditLogService (Module 15), and EventEmitter2 (dashboard
 * cache invalidation). Its Consolidated Payables view READS Module 3's PO
 * payables (read-only aggregation) via PrismaService.
 */
@Module({
  controllers: [ExpensesController, ExpenseCategoriesController, RecurringTemplatesController],
  providers: [
    ExpensesService,
    ExpensesRepository,
    ExpenseCategoriesService,
    RecurringTemplatesService,
    PayablesService,
    RecurringExpenseGeneratorJob,
  ],
})
export class ExpensesModule {}
