import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { PurchaseReturnsService } from './purchase-returns.service';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { ListPurchaseReturnsDto } from './dto/list-returns.dto';
import { UpdateSettlementDto } from './dto/update-settlement.dto';

const OPERATE = ['super_admin', 'admin', 'inventory_manager'] as const; // initiate/manage
const VIEW = ['super_admin', 'admin', 'inventory_manager', 'accountant', 'auditor'] as const;
const SETTLE = ['super_admin', 'admin', 'accountant'] as const;

@Controller('purchase-returns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseReturnsController {
  constructor(private readonly service: PurchaseReturnsService) {}

  @Get('returnable-items/:grnId')
  @Roles(...OPERATE)
  async returnable(@CurrentUser() user: AuthenticatedUser, @Param('grnId') grnId: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.returnableItems(user, grnId), message: 'Returnable items fetched' };
  }

  @Post()
  @Roles(...OPERATE)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePurchaseReturnDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.createReturn(user, dto), message: 'Purchase return created' };
  }

  @Get()
  @Roles(...VIEW)
  async list(@CurrentUser() user: AuthenticatedUser, @Query() q: ListPurchaseReturnsDto): Promise<ControllerResult<unknown>> {
    const { data, ...meta } = await this.service.list(user, q);
    return { data, meta, message: 'Purchase returns fetched' };
  }

  // /pending before /:id so it isn't captured as an id param.
  @Get('pending')
  @Roles(...SETTLE)
  async pending(@CurrentUser() user: AuthenticatedUser, @Query() q: ListPurchaseReturnsDto): Promise<ControllerResult<unknown>> {
    const { data, ...meta } = await this.service.list(user, q, true);
    return { data, meta, message: 'Pending purchase returns fetched' };
  }

  @Get(':id')
  @Roles(...VIEW)
  async detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.getById(user, id), message: 'Purchase return detail' };
  }

  @Get(':id/document')
  @Roles(...VIEW)
  async document(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.getById(user, id), message: 'Return-to-supplier document' };
  }

  @Put(':id/settlement')
  @Roles(...SETTLE)
  async settlement(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateSettlementDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.updateSettlement(user, id, dto), message: 'Settlement updated' };
  }
}
