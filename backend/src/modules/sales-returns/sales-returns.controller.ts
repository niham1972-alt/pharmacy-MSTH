import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { SalesReturnsService } from './sales-returns.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { ListReturnsDto } from './dto/list-returns.dto';

@Controller('sales-returns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesReturnsController {
  constructor(private readonly service: SalesReturnsService) {}

  @Get('eligibility/:saleId')
  @Roles('cashier', 'pharmacist', 'admin', 'super_admin')
  async eligibility(@CurrentUser() user: AuthenticatedUser, @Param('saleId') saleId: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.checkEligibility(user, saleId), message: 'Eligibility checked' };
  }

  @Post()
  @Roles('cashier', 'pharmacist', 'admin', 'super_admin')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReturnDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.createReturn(user, dto), message: 'Return processed' };
  }

  @Get()
  @Roles('admin', 'super_admin', 'pharmacist', 'accountant', 'auditor', 'cashier')
  async list(@CurrentUser() user: AuthenticatedUser, @Query() q: ListReturnsDto): Promise<ControllerResult<unknown>> {
    const result = await this.service.list(user, q);
    const { data, ...meta } = result;
    return { data, meta, message: 'Returns fetched' };
  }

  // Reports are defined BEFORE :id so "reports" isn't captured as an id param.
  @Get('reports/by-medicine')
  @Roles('admin', 'super_admin', 'pharmacist', 'auditor')
  async byMedicine(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.reportByMedicine(user, { branchId, dateFrom, dateTo }), message: 'Return rate by medicine' };
  }

  @Get('reports/by-reason')
  @Roles('admin', 'super_admin', 'pharmacist', 'auditor')
  async byReason(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.reportByReason(user, { branchId, dateFrom, dateTo }), message: 'Return rate by reason' };
  }

  @Get(':id')
  @Roles('admin', 'super_admin', 'pharmacist', 'accountant', 'auditor', 'cashier')
  async detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.getById(user, id), message: 'Return detail' };
  }

  @Get(':id/receipt')
  @Roles('admin', 'super_admin', 'pharmacist', 'accountant', 'auditor', 'cashier')
  async receipt(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.getById(user, id), message: 'Return receipt' };
  }
}
