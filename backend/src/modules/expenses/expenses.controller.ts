import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { ExpensesService } from './expenses.service';
import { PayablesService } from './payables.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { RejectExpenseDto } from './dto/approve-expense.dto';
import { RecordExpensePaymentDto } from './dto/record-payment.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';

// Financial data — cashier/pharmacist/inventory_manager have no access (spec §13).
const VIEW = ['super_admin', 'admin', 'accountant', 'auditor'] as const;
const WRITE = ['super_admin', 'admin', 'accountant'] as const;
const APPROVE = ['super_admin', 'admin'] as const;

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(
    private readonly service: ExpensesService,
    private readonly payables: PayablesService,
  ) {}

  @Post()
  @Roles(...WRITE)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateExpenseDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.create(user, dto), message: 'Expense recorded' };
  }

  // Static routes declared BEFORE ':id' so they aren't captured as an id.
  @Get('payables/consolidated')
  @Roles(...VIEW)
  async consolidated(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string): Promise<ControllerResult<unknown>> {
    const r = await this.payables.getConsolidated(user, branchId);
    return { data: r.rows, message: 'Consolidated payables', meta: { totals: r.totals } };
  }

  @Get('summary')
  @Roles(...VIEW)
  async summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('branchId') branchId?: string,
  ): Promise<ControllerResult<unknown>> {
    return { data: await this.service.summary(user, dateFrom, dateTo, branchId), message: 'Expense summary' };
  }

  @Get()
  @Roles(...VIEW)
  async list(@CurrentUser() user: AuthenticatedUser, @Query() q: QueryExpensesDto): Promise<ControllerResult<unknown>> {
    const r = await this.service.list(user, q);
    return { data: r.data, message: 'Expenses fetched', meta: { page: r.page, limit: r.limit, total: r.total, totalPages: r.totalPages } };
  }

  @Get(':id')
  @Roles(...VIEW)
  async detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.detail(user, id), message: 'Expense fetched' };
  }

  @Put(':id')
  @Roles(...WRITE)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateExpenseDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.update(user, id, dto), message: 'Expense updated' };
  }

  @Post(':id/approve')
  @Roles(...APPROVE)
  async approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.approve(user, id), message: 'Expense approved' };
  }

  @Post(':id/reject')
  @Roles(...APPROVE)
  async reject(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RejectExpenseDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.reject(user, id, dto.rejectedReason), message: 'Expense rejected' };
  }

  @Post(':id/payments')
  @Roles(...WRITE)
  async recordPayment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RecordExpensePaymentDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.recordPayment(user, id, dto), message: 'Payment recorded' };
  }
}
