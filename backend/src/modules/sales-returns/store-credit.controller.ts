import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { StoreCreditService } from './store-credit.service';

/** Mounted under /customers to sit alongside Module 8's customer resource. */
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StoreCreditController {
  constructor(private readonly storeCredit: StoreCreditService) {}

  @Get(':id/store-credit')
  @Roles('admin', 'super_admin', 'pharmacist', 'accountant', 'cashier')
  async getStoreCredit(@CurrentUser() user: AuthenticatedUser, @Param('id') customerId: string): Promise<ControllerResult<unknown>> {
    // Cashiers may see only the balance (for POS redemption), never the full ledger.
    const balanceOnly = user.role === 'cashier';
    return { data: await this.storeCredit.forCustomer(user, customerId, balanceOnly), message: 'Store credit fetched' };
  }
}
