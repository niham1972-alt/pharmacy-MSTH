import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchasePaymentsService } from './purchase-payments.service';
import {
  CancelPoDto,
  CreatePurchaseOrderDto,
  QueryPurchaseOrdersDto,
  RecordPaymentDto,
  RejectPoDto,
  UpdatePurchaseOrderDto,
} from './dto/purchase-order.dto';
import { SupplierDto } from './dto/create-grn.dto';

// NB: `cashier` is intentionally excluded from EVERY decorator here — the module
// is fully invisible to that role at the API level (spec §13/§17).
const READ = ['super_admin', 'admin', 'pharmacist', 'inventory_manager', 'accountant', 'auditor'] as const;
const WRITE = ['super_admin', 'admin', 'inventory_manager'] as const;
const APPROVE = ['super_admin', 'admin'] as const;

@Controller('purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseOrdersController {
  constructor(
    private readonly orders: PurchaseOrdersService,
    private readonly payments: PurchasePaymentsService,
  ) {}

  // --- Suppliers (stub for Module 7) ---------------------------------------
  @Get('suppliers')
  @Roles(...READ)
  async listSuppliers(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.payments.suppliers(user), message: 'Suppliers fetched' };
  }

  @Post('suppliers')
  @Roles(...WRITE)
  async createSupplier(@CurrentUser() user: AuthenticatedUser, @Body() dto: SupplierDto): Promise<ControllerResult<unknown>> {
    return { data: await this.payments.createSupplier(user, dto), message: 'Supplier created' };
  }

  // --- Aggregates ----------------------------------------------------------
  @Get('summary')
  @Roles('super_admin', 'admin', 'inventory_manager', 'accountant', 'auditor')
  async summary(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.orders.summary(user, branchId), message: 'Purchase summary fetched' };
  }

  @Get('pending-approvals')
  @Roles(...APPROVE)
  async pendingApprovals(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.orders.pendingApprovals(user, branchId), message: 'Pending approvals fetched' };
  }

  // --- Purchase Orders -----------------------------------------------------
  @Get('orders')
  @Roles(...READ)
  async list(@CurrentUser() user: AuthenticatedUser, @Query() dto: QueryPurchaseOrdersDto): Promise<ControllerResult<unknown>> {
    const r = await this.orders.list(user, dto);
    return { data: r.data, message: 'Purchase orders fetched', meta: { page: r.page, limit: r.limit, total: r.total, totalPages: r.totalPages } };
  }

  @Get('orders/:id')
  @Roles(...READ)
  async getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.orders.getById(user, id), message: 'Purchase order fetched' };
  }

  @Post('orders')
  @Roles(...WRITE)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePurchaseOrderDto): Promise<ControllerResult<unknown>> {
    return { data: await this.orders.create(user, dto), message: 'Purchase order created' };
  }

  @Put('orders/:id')
  @Roles(...WRITE)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdatePurchaseOrderDto): Promise<ControllerResult<unknown>> {
    return { data: await this.orders.update(user, id, dto), message: 'Purchase order updated' };
  }

  @Post('orders/:id/submit')
  @Roles(...WRITE)
  async submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.orders.submit(user, id), message: 'Purchase order submitted' };
  }

  @Post('orders/:id/approve')
  @Roles(...APPROVE)
  async approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.orders.approve(user, id), message: 'Purchase order approved' };
  }

  @Post('orders/:id/reject')
  @Roles(...APPROVE)
  async reject(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RejectPoDto): Promise<ControllerResult<unknown>> {
    return { data: await this.orders.reject(user, id, dto), message: 'Purchase order rejected' };
  }

  @Post('orders/:id/cancel')
  @Roles(...WRITE)
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CancelPoDto): Promise<ControllerResult<unknown>> {
    return { data: await this.orders.cancel(user, id, dto), message: 'Purchase order cancelled' };
  }

  @Get('orders/:id/pdf')
  @Roles(...READ)
  poPdf(): ControllerResult<null> {
    // Phase 2 — professional PDF generation (Puppeteer + Supabase Storage).
    return { data: null, message: 'PO PDF generation is not yet available' };
  }

  // --- Payments ------------------------------------------------------------
  @Post('orders/:id/payments')
  @Roles('super_admin', 'admin', 'accountant')
  async recordPayment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RecordPaymentDto): Promise<ControllerResult<unknown>> {
    return { data: await this.payments.record(user, id, dto), message: 'Payment recorded' };
  }

  @Get('orders/:id/payments')
  @Roles('super_admin', 'admin', 'accountant', 'auditor')
  async listPayments(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.payments.list(user, id), message: 'Payments fetched' };
  }
}
