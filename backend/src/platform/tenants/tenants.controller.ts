import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { PlatformAuthGuard } from '../common/platform-auth.guard';
import { PlatformRoles, PlatformRolesGuard } from '../common/platform-roles.decorator';
import { CurrentPlatformStaff } from '../common/current-platform-staff.decorator';
import { PlatformStaff } from '../common/platform-staff.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { TenantsService } from './tenants.service';
import { OnboardTenantDto, TenantActionDto, TenantListQuery, UpdateTenantDto } from '../dto/platform.dto';

@Controller('platform/tenants')
@UseGuards(PlatformAuthGuard, PlatformRolesGuard)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  @PlatformRoles('SUPER_ADMIN', 'SUPPORT', 'BILLING_OPS')
  async list(@Query() q: TenantListQuery): Promise<ControllerResult<unknown>> {
    const r = await this.tenants.list(q);
    return { data: r.data, message: 'Tenants fetched', meta: { page: r.page, limit: r.limit, total: r.total, totalPages: r.totalPages } };
  }

  @Get(':id')
  @PlatformRoles('SUPER_ADMIN', 'SUPPORT', 'BILLING_OPS')
  async detail(@Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.tenants.detail(id), message: 'Tenant fetched' };
  }

  @Get(':id/usage')
  @PlatformRoles('SUPER_ADMIN', 'SUPPORT', 'BILLING_OPS')
  async usage(@Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.tenants.usage(id), message: 'Usage fetched' };
  }

  @Post()
  @PlatformRoles('SUPER_ADMIN')
  async onboard(@CurrentPlatformStaff() staff: PlatformStaff, @Body() dto: OnboardTenantDto): Promise<ControllerResult<unknown>> {
    return { data: await this.tenants.onboard(staff, dto), message: 'Tenant onboarded' };
  }

  @Put(':id')
  @PlatformRoles('SUPER_ADMIN')
  async update(@CurrentPlatformStaff() staff: PlatformStaff, @Param('id') id: string, @Body() dto: UpdateTenantDto): Promise<ControllerResult<unknown>> {
    return { data: await this.tenants.update(staff, id, dto), message: 'Tenant updated' };
  }

  @Post(':id/suspend')
  @PlatformRoles('SUPER_ADMIN', 'BILLING_OPS')
  async suspend(@CurrentPlatformStaff() staff: PlatformStaff, @Param('id') id: string, @Body() dto: TenantActionDto): Promise<ControllerResult<unknown>> {
    return { data: await this.tenants.suspend(staff, id, dto.reason), message: 'Tenant suspended' };
  }

  @Post(':id/reactivate')
  @PlatformRoles('SUPER_ADMIN', 'BILLING_OPS')
  async reactivate(@CurrentPlatformStaff() staff: PlatformStaff, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.tenants.reactivate(staff, id), message: 'Tenant reactivated' };
  }

  @Post(':id/archive')
  @PlatformRoles('SUPER_ADMIN')
  async archive(@CurrentPlatformStaff() staff: PlatformStaff, @Param('id') id: string, @Body() dto: TenantActionDto): Promise<ControllerResult<unknown>> {
    return { data: await this.tenants.archive(staff, id, dto.reason), message: 'Tenant archived' };
  }
}
