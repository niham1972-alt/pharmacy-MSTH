import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { PlatformAuthGuard } from '../common/platform-auth.guard';
import { PlatformRoles, PlatformRolesGuard } from '../common/platform-roles.decorator';
import { CurrentPlatformStaff } from '../common/current-platform-staff.decorator';
import { PlatformStaff } from '../common/platform-staff.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { PlatformStaffService } from './platform-staff.service';
import { PlatformStaffDto, UpdatePlatformStaffDto } from '../dto/platform.dto';

@Controller('platform/staff-users')
@UseGuards(PlatformAuthGuard, PlatformRolesGuard)
export class PlatformStaffController {
  constructor(private readonly svc: PlatformStaffService) {}

  @Get()
  @PlatformRoles('SUPER_ADMIN')
  async list(): Promise<ControllerResult<unknown>> {
    return { data: await this.svc.list(), message: 'Platform staff fetched' };
  }

  @Post()
  @PlatformRoles('SUPER_ADMIN')
  async create(@CurrentPlatformStaff() staff: PlatformStaff, @Body() dto: PlatformStaffDto): Promise<ControllerResult<unknown>> {
    return { data: await this.svc.create(staff, dto), message: 'Platform staff created' };
  }

  @Put(':id')
  @PlatformRoles('SUPER_ADMIN')
  async update(@CurrentPlatformStaff() staff: PlatformStaff, @Param('id') id: string, @Body() dto: UpdatePlatformStaffDto): Promise<ControllerResult<unknown>> {
    return { data: await this.svc.update(staff, id, dto), message: 'Platform staff updated' };
  }
}
