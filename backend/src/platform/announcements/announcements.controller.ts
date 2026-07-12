import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { PlatformAuthGuard } from '../common/platform-auth.guard';
import { PlatformRoles, PlatformRolesGuard } from '../common/platform-roles.decorator';
import { CurrentPlatformStaff } from '../common/current-platform-staff.decorator';
import { PlatformStaff } from '../common/platform-staff.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementDto } from '../dto/platform.dto';

@Controller('platform/announcements')
@UseGuards(PlatformAuthGuard, PlatformRolesGuard)
export class AnnouncementsController {
  constructor(private readonly svc: AnnouncementsService) {}

  @Get()
  @PlatformRoles('SUPER_ADMIN')
  async list(): Promise<ControllerResult<unknown>> {
    return { data: await this.svc.list(), message: 'Announcements fetched' };
  }

  @Post()
  @PlatformRoles('SUPER_ADMIN')
  async create(@CurrentPlatformStaff() staff: PlatformStaff, @Body() dto: AnnouncementDto): Promise<ControllerResult<unknown>> {
    return { data: await this.svc.create(staff, dto), message: 'Announcement published' };
  }

  @Put(':id')
  @PlatformRoles('SUPER_ADMIN')
  async update(@CurrentPlatformStaff() staff: PlatformStaff, @Param('id') id: string, @Body() dto: AnnouncementDto): Promise<ControllerResult<unknown>> {
    return { data: await this.svc.update(staff, id, dto), message: 'Announcement updated' };
  }

  @Delete(':id')
  @PlatformRoles('SUPER_ADMIN')
  async remove(@CurrentPlatformStaff() staff: PlatformStaff, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.svc.remove(staff, id), message: 'Announcement expired' };
  }
}
