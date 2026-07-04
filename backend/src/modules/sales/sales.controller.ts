import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { SalesService } from './sales.service';
import { DiscountApprovalDto, FinalizeSaleDto, ParkSaleDto, PriceCheckDto, VoidSaleDto } from './dto/sales.dto';

const READ = ['super_admin', 'admin', 'pharmacist', 'cashier', 'accountant', 'auditor'] as const;
const SELL = ['super_admin', 'admin', 'pharmacist', 'cashier'] as const;
const ELEVATED = ['super_admin', 'admin', 'pharmacist'] as const;

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post('cart/price-check')
  @Roles(...SELL)
  async priceCheck(@CurrentUser() user: AuthenticatedUser, @Body() dto: PriceCheckDto): Promise<ControllerResult<unknown>> {
    return { data: await this.sales.priceCheck(user, dto), message: 'Price check complete' };
  }

  @Post('discount-approval')
  @Roles(...SELL)
  async discountApproval(@Body() dto: DiscountApprovalDto): Promise<ControllerResult<unknown>> {
    return { data: await this.sales.discountApproval(dto), message: 'Discount approved' };
  }

  @Post('parked')
  @Roles(...SELL)
  async park(@CurrentUser() user: AuthenticatedUser, @Body() dto: ParkSaleDto): Promise<ControllerResult<unknown>> {
    return { data: await this.sales.park(user, dto), message: 'Sale parked' };
  }

  @Get('parked')
  @Roles(...SELL)
  async listParked(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.sales.listParked(user), message: 'Parked sales fetched' };
  }

  @Delete('parked/:id')
  @Roles(...SELL)
  async discardParked(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.sales.discardParked(user, id), message: 'Parked sale discarded' };
  }

  @Post()
  @Roles(...SELL)
  async finalize(@CurrentUser() user: AuthenticatedUser, @Body() dto: FinalizeSaleDto): Promise<ControllerResult<unknown>> {
    return { data: await this.sales.finalize(user, dto), message: 'Sale completed' };
  }

  @Get()
  @Roles(...READ)
  async list(@CurrentUser() user: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    const r = await this.sales.list(user, { ...q, page: q.page ? Number(q.page) : undefined, limit: q.limit ? Number(q.limit) : undefined });
    return { data: r.data, message: 'Sales fetched', meta: { page: r.page, limit: r.limit, total: r.total, totalPages: r.totalPages } };
  }

  @Get(':id')
  @Roles(...READ)
  async getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.sales.getById(user, id), message: 'Sale fetched' };
  }

  @Post(':id/void')
  @Roles(...ELEVATED)
  async voidSale(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: VoidSaleDto): Promise<ControllerResult<unknown>> {
    return { data: await this.sales.voidSale(user, id, dto), message: 'Sale voided' };
  }
}
