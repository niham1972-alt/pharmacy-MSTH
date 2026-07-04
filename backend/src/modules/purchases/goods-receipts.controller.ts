import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { GoodsReceiptsService } from './goods-receipts.service';
import { CreateGrnDto } from './dto/create-grn.dto';

const READ = ['super_admin', 'admin', 'pharmacist', 'inventory_manager', 'accountant', 'auditor'] as const;
const WRITE = ['super_admin', 'admin', 'inventory_manager'] as const;

@Controller('purchases/grn')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GoodsReceiptsController {
  constructor(private readonly grn: GoodsReceiptsService) {}

  @Post()
  @Roles(...WRITE)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGrnDto): Promise<ControllerResult<unknown>> {
    return { data: await this.grn.confirmGrn(user, dto), message: 'Goods receipt confirmed' };
  }

  @Get()
  @Roles(...READ)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('purchaseOrderId') purchaseOrderId?: string,
  ): Promise<ControllerResult<unknown>> {
    const r = await this.grn.list(user, page ? Number(page) : 1, limit ? Number(limit) : 20, purchaseOrderId);
    return { data: r.data, message: 'Goods receipts fetched', meta: { page: r.page, limit: r.limit, total: r.total, totalPages: r.totalPages } };
  }

  @Get(':id')
  @Roles(...READ)
  async getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.grn.getById(user, id), message: 'Goods receipt fetched' };
  }

  @Get(':id/pdf')
  @Roles(...READ)
  grnPdf(): ControllerResult<null> {
    return { data: null, message: 'GRN PDF generation is not yet available' };
  }

  @Post(':id/acknowledge-variance')
  @Roles(...WRITE)
  async acknowledgeVariance(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body('note') note?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.grn.acknowledgeVariance(user, id, note), message: 'Variance acknowledged' };
  }
}
