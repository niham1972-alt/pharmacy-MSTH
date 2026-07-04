import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { CashierSessionsService } from './cashier-sessions.service';
import { CloseSessionDto, OpenSessionDto } from './dto/sales.dto';

@Controller('sales/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashierSessionsController {
  constructor(private readonly sessions: CashierSessionsService) {}

  @Post()
  @Roles('super_admin', 'admin', 'pharmacist', 'cashier')
  async open(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpenSessionDto): Promise<ControllerResult<unknown>> {
    return { data: await this.sessions.open(user, dto), message: 'Session opened' };
  }

  @Get('current')
  @Roles('super_admin', 'admin', 'pharmacist', 'cashier')
  async current(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.sessions.current(user, branchId), message: 'Current session fetched' };
  }

  @Get()
  @Roles('super_admin', 'admin', 'accountant', 'auditor')
  async list(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.sessions.list(user, branchId), message: 'Sessions fetched' };
  }

  @Get(':id')
  @Roles('super_admin', 'admin', 'pharmacist', 'cashier', 'accountant', 'auditor')
  async detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.sessions.detail(user, id), message: 'Session fetched' };
  }

  @Post(':id/close')
  @Roles('super_admin', 'admin', 'pharmacist', 'cashier')
  async close(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CloseSessionDto): Promise<ControllerResult<unknown>> {
    return { data: await this.sessions.close(user, id, dto), message: 'Session closed' };
  }
}
