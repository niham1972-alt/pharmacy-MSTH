import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { StepUpAuthService } from './step-up-auth.service';
import { RequestStepUpDto, VerifyStepUpDto } from './dto/users.dto';

const ALL = ['super_admin', 'admin', 'pharmacist', 'inventory_manager', 'cashier', 'accountant', 'auditor'] as const;

@Controller('auth/step-up')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StepUpAuthController {
  constructor(private readonly stepUp: StepUpAuthService) {}

  @Post('request')
  @Roles(...ALL)
  async request(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestStepUpDto): Promise<ControllerResult<unknown>> {
    return { data: await this.stepUp.request(user, dto), message: 'Step-up requested' };
  }

  @Post(':id/verify')
  @Roles(...ALL)
  async verify(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: VerifyStepUpDto): Promise<ControllerResult<unknown>> {
    return { data: await this.stepUp.verify(user, id, dto), message: 'Step-up verified' };
  }

  @Get(':id')
  @Roles(...ALL)
  async status(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.stepUp.status(user, id), message: 'Step-up status fetched' };
  }
}
