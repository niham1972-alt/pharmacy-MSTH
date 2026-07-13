import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { BulkCreateAdjustmentDto, CreateAdjustmentDto, QueryAdjustmentsDto, RejectAdjustmentDto } from './dto/stock-adjustment.dto';

const CREATE = ['super_admin', 'admin', 'inventory_manager'] as const;
const VIEW = ['super_admin', 'admin', 'inventory_manager', 'accountant', 'auditor'] as const;
const APPROVE = ['super_admin', 'admin'] as const;
const REPORT = ['super_admin', 'admin', 'inventory_manager', 'auditor'] as const;

@Controller('stock-adjustments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockAdjustmentsController {
  constructor(private readonly service: StockAdjustmentsService) {}

  @Post()
  @Roles(...CREATE)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAdjustmentDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.create(user, dto), message: 'Adjustment created' };
  }

  @Post('bulk')
  @Roles(...CREATE)
  async bulk(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkCreateAdjustmentDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.bulkCreate(user, dto), message: 'Bulk adjustments processed' };
  }

  // Static routes declared BEFORE ':id' so they aren't captured as an id.
  @Get('pending')
  @Roles(...APPROVE)
  async pending(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.service.pending(user), message: 'Pending adjustments fetched' };
  }

  @Get('reports/shrinkage')
  @Roles(...REPORT)
  async shrinkage(
    @CurrentUser() user: AuthenticatedUser,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('branchId') branchId?: string,
  ): Promise<ControllerResult<unknown>> {
    return { data: await this.service.shrinkageReport(user, dateFrom, dateTo, branchId), message: 'Shrinkage report' };
  }

  @Get()
  @Roles(...VIEW)
  async list(@CurrentUser() user: AuthenticatedUser, @Query() q: QueryAdjustmentsDto): Promise<ControllerResult<unknown>> {
    const r = await this.service.list(user, q);
    return { data: r.data, message: 'Adjustments fetched', meta: { page: r.page, limit: r.limit, total: r.total, totalPages: r.totalPages } };
  }

  @Get(':id')
  @Roles(...VIEW)
  async detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.detail(user, id), message: 'Adjustment fetched' };
  }

  @Post(':id/approve')
  @Roles(...APPROVE)
  async approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.approve(user, id), message: 'Adjustment approved' };
  }

  @Post(':id/reject')
  @Roles(...APPROVE)
  async reject(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RejectAdjustmentDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.reject(user, id, dto.rejectedReason), message: 'Adjustment rejected' };
  }
}
