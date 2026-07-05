import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { BatchesService } from './batches.service';
import { WriteOffsService } from './write-offs.service';
import { RecallsService } from './recalls.service';
import { FlagRecallDto, QueryBatchesDto, ResolveRecallDto, WriteOffBatchDto } from './dto/batches.dto';

const READ = ['super_admin', 'admin', 'pharmacist', 'inventory_manager', 'auditor'] as const;
const WRITE_OFF = ['super_admin', 'admin', 'inventory_manager'] as const;
const RECALL = ['super_admin', 'admin', 'pharmacist'] as const;

@Controller('batches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BatchesController {
  constructor(
    private readonly batches: BatchesService,
    private readonly writeOffs: WriteOffsService,
    private readonly recalls: RecallsService,
  ) {}

  @Get()
  @Roles(...READ)
  async list(@CurrentUser() user: AuthenticatedUser, @Query() q: QueryBatchesDto): Promise<ControllerResult<unknown>> {
    const r = await this.batches.list(user, q);
    return { data: r.data, message: 'Batches fetched', meta: { page: r.page, limit: r.limit, total: r.total, totalPages: r.totalPages } };
  }

  @Get('expiring')
  @Roles(...READ)
  async expiring(@CurrentUser() user: AuthenticatedUser, @Query('thresholdDays') thresholdDays?: string, @Query('branchId') branchId?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.batches.expiring(user, thresholdDays ? Number(thresholdDays) : undefined, branchId), message: 'Expiring batches fetched' };
  }

  @Get('expired')
  @Roles(...READ)
  async expired(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.batches.expired(user, branchId), message: 'Expired batches fetched' };
  }

  // --- Write-offs (declared before :id) ------------------------------------
  @Post('write-off')
  @Roles(...WRITE_OFF)
  async writeOff(@CurrentUser() user: AuthenticatedUser, @Body() dto: WriteOffBatchDto): Promise<ControllerResult<unknown>> {
    return { data: await this.writeOffs.writeOff(user, dto), message: 'Batches written off' };
  }

  @Get('write-offs')
  @Roles('super_admin', 'admin', 'inventory_manager', 'accountant', 'auditor')
  async writeOffHistory(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.writeOffs.history(user, branchId), message: 'Write-off history fetched' };
  }

  // --- Recalls (declared before :id) ---------------------------------------
  @Get('recalls')
  @Roles(...READ)
  async recallList(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.recalls.list(user), message: 'Recalls fetched' };
  }

  @Post('recalls/:id/resolve')
  @Roles(...RECALL)
  async resolveRecall(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ResolveRecallDto): Promise<ControllerResult<unknown>> {
    return { data: await this.recalls.resolve(user, id, dto), message: 'Recall resolved' };
  }

  @Get('recalls/:id/affected-sales')
  @Roles('super_admin', 'admin', 'pharmacist', 'auditor')
  async affectedSales(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.recalls.affectedSales(user, id), message: 'Affected sales fetched' };
  }

  // --- Per-batch (declared last so 'expiring' etc. aren't captured as :id) --
  @Get(':id')
  @Roles(...READ)
  async detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.batches.detail(user, id), message: 'Batch detail fetched' };
  }

  @Post(':id/recall')
  @Roles(...RECALL)
  async flagRecall(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: FlagRecallDto): Promise<ControllerResult<unknown>> {
    return { data: await this.recalls.flag(user, id, dto), message: 'Batch flagged as recalled' };
  }
}
