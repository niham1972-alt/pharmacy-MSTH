import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { SuppliersService } from './suppliers.service';
import { SetPreferredSupplierDto } from './dto/suppliers.dto';

@Controller('medicine-preferred-suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PreferredSuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Post()
  @Roles('super_admin', 'admin', 'inventory_manager')
  async set(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetPreferredSupplierDto): Promise<ControllerResult<unknown>> {
    return { data: await this.suppliers.setPreferredSupplier(user, dto), message: 'Preferred supplier set' };
  }

  @Get(':medicineId')
  @Roles('super_admin', 'admin', 'inventory_manager', 'pharmacist')
  async get(@CurrentUser() user: AuthenticatedUser, @Param('medicineId') medicineId: string): Promise<ControllerResult<unknown>> {
    return { data: await this.suppliers.preferredForMedicine(user, medicineId), message: 'Preferred suppliers fetched' };
  }
}
