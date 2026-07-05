import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { CustomersService } from './customers.service';
import { MergeService } from './merge.service';
import { AddNoteDto, AssignTagDto, CheckDuplicateDto, CreateCustomerDto, MergeCustomersDto, QuickAddCustomerDto, UpdateCustomerDto } from './dto/customers.dto';

const SEARCH = ['super_admin', 'admin', 'pharmacist', 'cashier'] as const;
const READ = ['super_admin', 'admin', 'pharmacist', 'accountant', 'auditor'] as const;
const WRITE = ['super_admin', 'admin', 'pharmacist'] as const;
const HEALTH_ROLES = ['super_admin', 'admin', 'pharmacist'];

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly merge: MergeService,
  ) {}

  // --- Narrow POS endpoints (before :id) ----------------------------------
  @Get('search')
  @Roles(...SEARCH)
  async search(@CurrentUser() user: AuthenticatedUser, @Query('q') q?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.customers.search(user, q?.trim() ?? ''), message: 'Customers found' };
  }

  @Post('quick-add')
  @Roles(...SEARCH)
  async quickAdd(@CurrentUser() user: AuthenticatedUser, @Body() dto: QuickAddCustomerDto): Promise<ControllerResult<unknown>> {
    return { data: await this.customers.quickAdd(user, dto), message: 'Customer added' };
  }

  @Post('check-duplicate')
  @Roles(...SEARCH)
  async checkDuplicate(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckDuplicateDto): Promise<ControllerResult<unknown>> {
    return { data: await this.customers.checkDuplicate(user, dto), message: 'Duplicate check complete' };
  }

  @Post('merge')
  @Roles(...WRITE)
  async mergeCustomers(@CurrentUser() user: AuthenticatedUser, @Body() dto: MergeCustomersDto): Promise<ControllerResult<unknown>> {
    return { data: await this.merge.merge(user, dto), message: 'Customers merged' };
  }

  // --- List / full CRUD ----------------------------------------------------
  @Get()
  @Roles(...READ)
  async list(@CurrentUser() user: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    // hasAllergiesFlag is a clinical filter — only honoured for pharmacist/admin.
    const hasAllergiesFlag = HEALTH_ROLES.includes(user.role) ? q.hasAllergiesFlag : undefined;
    const r = await this.customers.list(user, { ...q, hasAllergiesFlag });
    return { data: r.data, message: 'Customers fetched', meta: { page: r.page, limit: r.limit, total: r.total, totalPages: r.totalPages } };
  }

  @Post()
  @Roles(...WRITE)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCustomerDto): Promise<ControllerResult<unknown>> {
    return { data: await this.customers.create(user, dto), message: 'Customer created' };
  }

  @Get(':id')
  @Roles(...READ)
  async detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.customers.detail(user, id), message: 'Customer fetched' };
  }

  @Put(':id')
  @Roles(...WRITE)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateCustomerDto): Promise<ControllerResult<unknown>> {
    return { data: await this.customers.update(user, id, dto), message: 'Customer updated' };
  }

  @Post(':id/archive')
  @Roles('super_admin', 'admin')
  async archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.customers.archive(user, id), message: 'Customer archived' };
  }

  // --- History (live from Module 4) ---------------------------------------
  @Get(':id/purchase-history')
  @Roles(...READ)
  async purchaseHistory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Query('page') page?: string): Promise<ControllerResult<unknown>> {
    const r = await this.customers.purchaseHistory(user, id, page ? Number(page) : 1);
    return { data: r.data, message: 'Purchase history fetched', meta: { page: r.page, limit: r.limit, total: r.total, totalPages: r.totalPages } };
  }

  @Get(':id/medication-summary')
  @Roles(...WRITE)
  async medicationSummary(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.customers.medicationSummary(user, id), message: 'Medication summary fetched' };
  }

  // --- Tags / notes --------------------------------------------------------
  @Post(':id/tags')
  @Roles(...WRITE)
  async assignTag(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AssignTagDto): Promise<ControllerResult<unknown>> {
    return { data: await this.customers.assignTag(user, id, dto), message: 'Tag assigned' };
  }

  @Delete(':id/tags/:tagId')
  @Roles(...WRITE)
  async removeTag(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('tagId') tagId: string): Promise<ControllerResult<unknown>> {
    return { data: await this.customers.removeTag(user, id, tagId), message: 'Tag removed' };
  }

  @Post(':id/notes')
  @Roles(...WRITE)
  async addNote(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AddNoteDto): Promise<ControllerResult<unknown>> {
    return { data: await this.customers.addNote(user, id, dto), message: 'Note added' };
  }
}
