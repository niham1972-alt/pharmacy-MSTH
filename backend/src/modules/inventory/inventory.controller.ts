import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { InventoryReadService } from './inventory-read.service';
import { ReconciliationService } from './reconciliation.service';
import { StockTransfersService } from './stock-transfers.service';
import { CreateTransferDto, QueryInventoryDto, SubmitReconciliationDto } from './dto/inventory.dto';

const READ = ['super_admin', 'admin', 'pharmacist', 'inventory_manager', 'accountant', 'auditor'] as const;
const MANAGE = ['super_admin', 'admin', 'inventory_manager'] as const;
const VALUATION = ['super_admin', 'admin', 'inventory_manager', 'accountant', 'auditor'] as const;

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(
    private readonly read: InventoryReadService,
    private readonly reconciliation: ReconciliationService,
    private readonly transfers: StockTransfersService,
  ) {}

  @Get()
  @Roles(...READ, 'cashier')
  async list(@CurrentUser() user: AuthenticatedUser, @Query() q: QueryInventoryDto): Promise<ControllerResult<unknown>> {
    const r = await this.read.list(user, q);
    return { data: r.data, message: 'Inventory fetched', meta: { page: r.page, limit: r.limit, total: r.total, totalPages: r.totalPages } };
  }

  @Get('summary')
  @Roles(...VALUATION)
  async summary(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.read.summary(user, branchId), message: 'Inventory summary fetched' };
  }

  @Get('reorder-suggestions')
  @Roles(...MANAGE)
  async reorder(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.read.reorderSuggestions(user, branchId), message: 'Reorder suggestions fetched' };
  }

  @Get('valuation')
  @Roles(...VALUATION)
  async valuation(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.read.valuation(user, branchId), message: 'Valuation fetched' };
  }

  // --- Transfers ------------------------------------------------------------
  @Post('transfers')
  @Roles(...MANAGE)
  async createTransfer(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTransferDto): Promise<ControllerResult<unknown>> {
    return { data: await this.transfers.create(user, dto), message: 'Transfer created' };
  }

  @Get('transfers')
  @Roles('super_admin', 'admin', 'inventory_manager', 'auditor')
  async listTransfers(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.transfers.list(user), message: 'Transfers fetched' };
  }

  @Post('transfers/:id/approve')
  @Roles('super_admin', 'admin')
  async approveTransfer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.transfers.approve(user, id), message: 'Transfer approved' };
  }

  @Post('transfers/:id/receive')
  @Roles(...MANAGE)
  async receiveTransfer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.transfers.receive(user, id), message: 'Transfer received' };
  }

  // --- Reconciliation -------------------------------------------------------
  @Post('reconciliation')
  @Roles(...MANAGE)
  async submitReconciliation(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitReconciliationDto): Promise<ControllerResult<unknown>> {
    return { data: await this.reconciliation.submit(user, dto), message: 'Reconciliation submitted' };
  }

  @Get('reconciliation')
  @Roles('super_admin', 'admin', 'inventory_manager', 'auditor')
  async listReconciliation(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.reconciliation.list(user, branchId), message: 'Reconciliations fetched' };
  }

  // --- Per-medicine (declared last so 'summary' etc. aren't captured as :medicineId) ---
  @Get(':medicineId')
  @Roles('super_admin', 'admin', 'pharmacist', 'inventory_manager', 'cashier', 'accountant', 'auditor')
  async detail(@CurrentUser() user: AuthenticatedUser, @Param('medicineId') medicineId: string, @Query('branchId') branchId?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.read.detail(user, medicineId, branchId), message: 'Stock detail fetched' };
  }

  @Get(':medicineId/ledger')
  @Roles(...READ)
  async ledger(@CurrentUser() user: AuthenticatedUser, @Param('medicineId') medicineId: string, @Query('page') page?: string, @Query('limit') limit?: string, @Query('branchId') branchId?: string): Promise<ControllerResult<unknown>> {
    const r = await this.read.ledger(user, medicineId, page ? Number(page) : 1, limit ? Number(limit) : 30, branchId);
    return { data: r.data, message: 'Ledger fetched', meta: { page: r.page, limit: r.limit, total: r.total, totalPages: r.totalPages } };
  }
}
