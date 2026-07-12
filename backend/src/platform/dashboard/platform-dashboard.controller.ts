import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlatformAuthGuard } from '../common/platform-auth.guard';
import { PlatformRoles, PlatformRolesGuard } from '../common/platform-roles.decorator';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { PlatformDashboardService } from './platform-dashboard.service';
import { PlatformAuditService } from '../common/platform-audit.service';

@Controller('platform')
@UseGuards(PlatformAuthGuard, PlatformRolesGuard)
export class PlatformDashboardController {
  constructor(private readonly dashboard: PlatformDashboardService, private readonly audit: PlatformAuditService) {}

  @Get('dashboard/summary')
  @PlatformRoles('SUPER_ADMIN', 'SUPPORT', 'BILLING_OPS')
  async summary(): Promise<ControllerResult<unknown>> {
    return { data: await this.dashboard.summary(), message: 'Platform summary fetched' };
  }

  @Get('audit-log')
  @PlatformRoles('SUPER_ADMIN')
  async auditLog(): Promise<ControllerResult<unknown>> {
    return { data: await this.audit.list(200), message: 'Platform audit log fetched' };
  }
}
