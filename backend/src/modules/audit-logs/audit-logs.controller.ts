import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { AuditLogsService } from './audit-logs.service';

// Global log is admin/auditor only. The entity-scoped trail is broader (mirrors
// the calling module's own entity access) so embedded Audit Trail tabs work.
const GLOBAL = ['super_admin', 'admin', 'auditor'] as const;
const ENTITY = ['super_admin', 'admin', 'pharmacist', 'inventory_manager', 'accountant', 'auditor'] as const;
const INTEGRITY = ['super_admin', 'admin'] as const;

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditLogsController {
  constructor(private readonly service: AuditLogsService) {}

  @Get()
  @Roles(...GLOBAL)
  async list(@CurrentUser() user: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    const r = await this.service.list(user, q);
    return { data: r.data, message: 'Audit logs fetched', meta: { page: r.page, limit: r.limit, total: r.total, totalPages: r.totalPages } };
  }

  @Get('action-registry')
  @Roles(...ENTITY)
  registry(): ControllerResult<unknown> {
    return { data: this.service.actionRegistry(), message: 'Action registry fetched' };
  }

  @Get('entity')
  @Roles(...ENTITY)
  async entity(@CurrentUser() user: AuthenticatedUser, @Query('entityType') entityType: string, @Query('entityId') entityId: string, @Query('page') page?: string): Promise<ControllerResult<unknown>> {
    const r = await this.service.entityTrail(user, entityType, entityId, page ? Number(page) : 1);
    return { data: r.data, message: 'Entity audit trail fetched', meta: { page: r.page, limit: r.limit, total: r.total, totalPages: r.totalPages } };
  }

  @Get('sensitive')
  @Roles(...GLOBAL)
  async sensitive(@CurrentUser() user: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    const r = await this.service.sensitive(user, q);
    return { data: r.data, message: 'Sensitive events fetched', meta: { page: r.page, limit: r.limit, total: r.total, totalPages: r.totalPages } };
  }

  @Get('export')
  @Roles(...GLOBAL)
  async exportCsv(@CurrentUser() user: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    const csv = await this.service.exportCsv(user, q);
    return { data: { csv, filename: `audit-log-${new Date().toISOString().slice(0, 10)}.csv` }, message: 'Export ready' };
  }

  @Get('controlled-substance-report')
  @Roles('super_admin', 'admin', 'pharmacist', 'auditor')
  async controlledSubstance(@CurrentUser() user: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    const csv = await this.service.controlledSubstanceReport(user, q);
    return { data: { csv, filename: `controlled-substance-report-${new Date().toISOString().slice(0, 10)}.csv` }, message: 'Report ready' };
  }

  @Get('integrity-status')
  @Roles(...INTEGRITY)
  async integrityStatus(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.service.integrityStatus(user), message: 'Integrity status fetched' };
  }

  @Post('integrity-check/run')
  @Roles(...INTEGRITY)
  async runIntegrity(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.service.runIntegrityCheck(user), message: 'Integrity check complete' };
  }

  // --- User-scoped (declared last so 'entity'/'sensitive'/etc. aren't captured) ---
  @Get('user/:userId')
  @Roles(...GLOBAL)
  async userActivity(@CurrentUser() user: AuthenticatedUser, @Param('userId') userId: string, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    const r = await this.service.userActivity(user, userId, q);
    return { data: r.data, message: 'User activity fetched', meta: { page: r.page, limit: r.limit, total: r.total, totalPages: r.totalPages } };
  }
}
