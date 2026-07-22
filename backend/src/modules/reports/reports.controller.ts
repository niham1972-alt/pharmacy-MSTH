import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { ReportsService } from './reports.service';
import { ExportJobService } from './export/export-job.service';
import { SavedConfigurationsService } from './saved-configurations.service';
import { ExportRequestDto, SaveConfigDto } from './dto/export-request.dto';
import { ReportFilters } from './interfaces/report-filters.interface';

const FILTER_KEYS = ['dateFrom', 'dateTo', 'branchId', 'categoryId', 'supplierId', 'customerId', 'medicineId', 'cashierId', 'paymentMethod', 'reasonCode', 'batchId', 'metric', 'limit', 'dateRangeType'] as const;
function toFilters(q: Record<string, string | undefined>): ReportFilters {
  const f: ReportFilters = {};
  for (const k of FILTER_KEYS) if (q[k] !== undefined) (f as Record<string, string>)[k] = q[k] as string;
  return f;
}

// Access is enforced twice: @Roles here (coarse) AND assertReportAccess inside the
// service (the authoritative per-report mirror). super_admin is implicit everywhere.
const FINANCIAL = ['super_admin', 'admin', 'accountant'] as const;
const PAYABLES = ['super_admin', 'admin', 'accountant', 'auditor'] as const;
const PROCUREMENT = ['super_admin', 'admin', 'inventory_manager', 'accountant', 'auditor'] as const;
const INVENTORY = ['super_admin', 'admin', 'pharmacist', 'inventory_manager', 'auditor'] as const;
const SALES_VIEW = ['super_admin', 'admin', 'pharmacist', 'accountant', 'auditor'] as const;
const SALES_RETURNS = ['super_admin', 'admin', 'pharmacist', 'auditor'] as const;
const CUSTOMER = ['super_admin', 'admin', 'pharmacist'] as const;
const COMPLIANCE = ['super_admin', 'admin', 'pharmacist', 'auditor'] as const;
const SHRINK = ['super_admin', 'admin', 'inventory_manager', 'auditor'] as const;
const AUDIT = ['super_admin', 'admin', 'auditor'] as const;
const ANY = ['super_admin', 'admin', 'pharmacist', 'inventory_manager', 'accountant', 'auditor'] as const;

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly exports: ExportJobService,
    private readonly saved: SavedConfigurationsService,
  ) {}

  @Get('profit-loss') @Roles(...FINANCIAL)
  async profitLoss(@CurrentUser() u: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    return { data: await this.reports.run(u, 'PROFIT_LOSS', toFilters(q)), message: 'Profit & loss' };
  }

  @Get('sales-register') @Roles(...SALES_VIEW)
  async salesRegister(@CurrentUser() u: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    return { data: await this.reports.run(u, 'SALES_REGISTER', toFilters(q)), message: 'Sales register' };
  }

  @Get('purchase-summary') @Roles(...PROCUREMENT)
  async purchaseSummary(@CurrentUser() u: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    return { data: await this.reports.run(u, 'PURCHASE_SUMMARY', toFilters(q)), message: 'Purchase summary' };
  }

  @Get('accounts-payable') @Roles(...PAYABLES)
  async accountsPayable(@CurrentUser() u: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    return { data: await this.reports.run(u, 'ACCOUNTS_PAYABLE', toFilters(q)), message: 'Accounts payable' };
  }

  @Get('tax-summary') @Roles(...FINANCIAL)
  async taxSummary(@CurrentUser() u: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    return { data: await this.reports.run(u, 'TAX_SUMMARY', toFilters(q)), message: 'Tax summary' };
  }

  @Get('stock-valuation') @Roles(...PROCUREMENT)
  async stockValuation(@CurrentUser() u: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    return { data: await this.reports.run(u, 'STOCK_VALUATION', toFilters(q)), message: 'Stock valuation' };
  }

  @Get('stock-movement') @Roles(...PROCUREMENT)
  async stockMovement(@CurrentUser() u: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    return { data: await this.reports.run(u, 'STOCK_MOVEMENT', toFilters(q)), message: 'Stock movement' };
  }

  @Get('expiring-stock') @Roles(...INVENTORY)
  async expiringStock(@CurrentUser() u: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    return { data: await this.reports.run(u, 'EXPIRING_STOCK', toFilters(q)), message: 'Expiring stock' };
  }

  @Get('batch-traceability/:batchId') @Roles(...INVENTORY)
  async batchTraceability(@CurrentUser() u: AuthenticatedUser, @Param('batchId') batchId: string, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    return { data: await this.reports.run(u, 'BATCH_TRACEABILITY', { ...toFilters(q), batchId }), message: 'Batch traceability' };
  }

  @Get('top-selling') @Roles(...INVENTORY)
  async topSelling(@CurrentUser() u: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    return { data: await this.reports.run(u, 'TOP_SELLING', toFilters(q)), message: 'Top-selling medicines' };
  }

  @Get('sales-returns') @Roles(...SALES_RETURNS)
  async salesReturns(@CurrentUser() u: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    return { data: await this.reports.run(u, 'SALES_RETURNS', toFilters(q)), message: 'Sales returns' };
  }

  @Get('customer-history/:customerId') @Roles(...CUSTOMER)
  async customerHistory(@CurrentUser() u: AuthenticatedUser, @Param('customerId') customerId: string, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    return { data: await this.reports.run(u, 'CUSTOMER_HISTORY', { ...toFilters(q), customerId }), message: 'Customer history' };
  }

  @Get('controlled-substance-log') @Roles(...COMPLIANCE)
  async controlledSubstanceLog(@CurrentUser() u: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    return { data: await this.reports.run(u, 'CONTROLLED_SUBSTANCE_LOG', toFilters(q)), message: 'Controlled substance log' };
  }

  @Get('supplier-performance') @Roles(...PROCUREMENT)
  async supplierPerformance(@CurrentUser() u: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    return { data: await this.reports.run(u, 'SUPPLIER_PERFORMANCE', toFilters(q)), message: 'Supplier performance' };
  }

  @Get('purchase-returns') @Roles(...PROCUREMENT)
  async purchaseReturns(@CurrentUser() u: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    return { data: await this.reports.run(u, 'PURCHASE_RETURNS', toFilters(q)), message: 'Purchase returns' };
  }

  @Get('shrinkage') @Roles(...SHRINK)
  async shrinkage(@CurrentUser() u: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    return { data: await this.reports.run(u, 'SHRINKAGE', toFilters(q)), message: 'Shrinkage' };
  }

  @Get('audit-summary') @Roles(...AUDIT)
  async auditSummary(@CurrentUser() u: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    return { data: await this.reports.run(u, 'AUDIT_SUMMARY', toFilters(q)), message: 'Audit summary' };
  }

  // --- Export (async) ------------------------------------------------------
  @Post('export') @Roles(...ANY)
  async requestExport(@CurrentUser() u: AuthenticatedUser, @Body() dto: ExportRequestDto): Promise<ControllerResult<unknown>> {
    return { data: await this.exports.request(u, dto.reportType, (dto.filters ?? {}) as ReportFilters, dto.format), message: 'Export requested' };
  }

  @Get('export/:jobId') @Roles(...ANY)
  async exportStatus(@CurrentUser() u: AuthenticatedUser, @Param('jobId') jobId: string): Promise<ControllerResult<unknown>> {
    return { data: await this.exports.getJob(u, jobId), message: 'Export job status' };
  }

  // --- Saved configurations ------------------------------------------------
  @Get('saved-configurations') @Roles(...ANY)
  async listSaved(@CurrentUser() u: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.saved.list(u), message: 'Saved report configurations' };
  }

  @Post('saved-configurations') @Roles(...ANY)
  async createSaved(@CurrentUser() u: AuthenticatedUser, @Body() dto: SaveConfigDto): Promise<ControllerResult<unknown>> {
    return { data: await this.saved.create(u, { reportType: dto.reportType, name: dto.name, filters: (dto.filters ?? {}) as ReportFilters }), message: 'Configuration saved' };
  }

  @Delete('saved-configurations/:id') @Roles(...ANY)
  async deleteSaved(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.saved.remove(u, id), message: 'Configuration deleted' };
  }
}
