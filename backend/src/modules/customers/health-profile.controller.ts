import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { HealthProfileService } from './health-profile.service';
import { UpdateHealthProfileDto } from './dto/customers.dto';

/**
 * Health-adjacent data lives behind its OWN controller with the tightest role
 * set (admin/pharmacist only). A cashier/accountant/auditor/inventory_manager
 * hitting these routes gets a 403 at the guard — the data is architecturally
 * separated, not merely field-redacted from a shared response.
 */
@Controller('customers/:id/health-profile')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HealthProfileController {
  constructor(private readonly health: HealthProfileService) {}

  @Get()
  @Roles('super_admin', 'admin', 'pharmacist')
  async get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.health.get(user, id), message: 'Health profile fetched' };
  }

  @Put()
  @Roles('super_admin', 'admin', 'pharmacist')
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateHealthProfileDto): Promise<ControllerResult<unknown>> {
    return { data: await this.health.update(user, id, dto), message: 'Health profile updated' };
  }
}
