import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { PlatformAuthGuard } from '../common/platform-auth.guard';
import { PlatformRoles, PlatformRolesGuard } from '../common/platform-roles.decorator';
import { CurrentPlatformStaff } from '../common/current-platform-staff.decorator';
import { PlatformStaff } from '../common/platform-staff.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { SubscriptionPlansService } from './subscription-plans.service';
import { ChangePlanDto, SubscriptionPlanDto } from '../dto/platform.dto';

@Controller('platform')
@UseGuards(PlatformAuthGuard, PlatformRolesGuard)
export class SubscriptionPlansController {
  constructor(private readonly plans: SubscriptionPlansService) {}

  @Get('subscription-plans')
  @PlatformRoles('SUPER_ADMIN', 'SUPPORT', 'BILLING_OPS')
  async list(): Promise<ControllerResult<unknown>> {
    return { data: await this.plans.list(), message: 'Plans fetched' };
  }

  @Post('subscription-plans')
  @PlatformRoles('SUPER_ADMIN', 'BILLING_OPS')
  async create(@CurrentPlatformStaff() staff: PlatformStaff, @Body() dto: SubscriptionPlanDto): Promise<ControllerResult<unknown>> {
    return { data: await this.plans.create(staff, dto), message: 'Plan created' };
  }

  @Put('subscription-plans/:id')
  @PlatformRoles('SUPER_ADMIN', 'BILLING_OPS')
  async update(@CurrentPlatformStaff() staff: PlatformStaff, @Param('id') id: string, @Body() dto: SubscriptionPlanDto): Promise<ControllerResult<unknown>> {
    return { data: await this.plans.update(staff, id, dto), message: 'Plan updated' };
  }

  @Delete('subscription-plans/:id')
  @PlatformRoles('SUPER_ADMIN', 'BILLING_OPS')
  async retire(@CurrentPlatformStaff() staff: PlatformStaff, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.plans.retire(staff, id), message: 'Plan retired' };
  }

  @Post('tenants/:id/change-plan')
  @PlatformRoles('SUPER_ADMIN', 'BILLING_OPS')
  async changePlan(@CurrentPlatformStaff() staff: PlatformStaff, @Param('id') id: string, @Body() dto: ChangePlanDto): Promise<ControllerResult<unknown>> {
    return { data: await this.plans.changePlan(staff, id, dto.subscriptionPlanId), message: 'Plan changed' };
  }
}
