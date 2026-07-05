import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { PrescriptionsService } from './prescriptions.service';
import { UploadPrescriptionDto } from './dto/customers.dto';

@Controller('customers/:id/prescriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Get()
  @Roles('super_admin', 'admin', 'pharmacist')
  async list(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.prescriptions.list(user, id), message: 'Prescriptions fetched' };
  }

  @Post()
  @Roles('super_admin', 'admin', 'pharmacist')
  async upload(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UploadPrescriptionDto): Promise<ControllerResult<unknown>> {
    return { data: await this.prescriptions.upload(user, id, dto), message: 'Prescription uploaded' };
  }
}
