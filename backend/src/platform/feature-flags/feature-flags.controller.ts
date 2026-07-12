import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { PlatformAuthGuard } from '../common/platform-auth.guard';
import { PlatformRoles, PlatformRolesGuard } from '../common/platform-roles.decorator';
import { CurrentPlatformStaff } from '../common/current-platform-staff.decorator';
import { PlatformStaff } from '../common/platform-staff.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagDto } from '../dto/platform.dto';

@Controller('platform/feature-flags')
@UseGuards(PlatformAuthGuard, PlatformRolesGuard)
export class FeatureFlagsController {
  constructor(private readonly svc: FeatureFlagsService) {}

  @Get()
  @PlatformRoles('SUPER_ADMIN')
  async list(): Promise<ControllerResult<unknown>> {
    return { data: await this.svc.list(), message: 'Feature flags fetched' };
  }

  @Post()
  @PlatformRoles('SUPER_ADMIN')
  async create(@CurrentPlatformStaff() staff: PlatformStaff, @Body() dto: FeatureFlagDto): Promise<ControllerResult<unknown>> {
    return { data: await this.svc.create(staff, dto), message: 'Feature flag created' };
  }

  @Put(':id')
  @PlatformRoles('SUPER_ADMIN')
  async update(@CurrentPlatformStaff() staff: PlatformStaff, @Param('id') id: string, @Body() dto: FeatureFlagDto): Promise<ControllerResult<unknown>> {
    return { data: await this.svc.update(staff, id, dto), message: 'Feature flag updated' };
  }

  @Delete(':id')
  @PlatformRoles('SUPER_ADMIN')
  async remove(@CurrentPlatformStaff() staff: PlatformStaff, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.svc.remove(staff, id), message: 'Feature flag deleted' };
  }
}
