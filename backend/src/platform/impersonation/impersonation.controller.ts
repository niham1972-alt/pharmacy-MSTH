import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PlatformAuthGuard } from '../common/platform-auth.guard';
import { PlatformRoles, PlatformRolesGuard } from '../common/platform-roles.decorator';
import { CurrentPlatformStaff } from '../common/current-platform-staff.decorator';
import { PlatformStaff } from '../common/platform-staff.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { ImpersonationService } from './impersonation.service';
import { StartImpersonationDto } from '../dto/platform.dto';

@Controller('platform/impersonation')
@UseGuards(PlatformAuthGuard, PlatformRolesGuard)
export class ImpersonationController {
  constructor(private readonly svc: ImpersonationService) {}

  @Post('start')
  @PlatformRoles('SUPER_ADMIN', 'SUPPORT')
  async start(@CurrentPlatformStaff() staff: PlatformStaff, @Body() dto: StartImpersonationDto): Promise<ControllerResult<unknown>> {
    return { data: await this.svc.start(staff, dto), message: 'Impersonation started' };
  }

  @Post(':id/end')
  @PlatformRoles('SUPER_ADMIN', 'SUPPORT')
  async end(@CurrentPlatformStaff() staff: PlatformStaff, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.svc.end(staff, id), message: 'Impersonation ended' };
  }

  @Get('history')
  @PlatformRoles('SUPER_ADMIN', 'SUPPORT')
  async history(@CurrentPlatformStaff() staff: PlatformStaff, @Query('limit') limit?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.svc.history(staff, limit ? Number(limit) : 100), message: 'History fetched' };
  }
}
