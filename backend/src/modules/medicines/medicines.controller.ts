import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { MedicinesService } from './medicines.service';
import { CreateMedicineDto, UpdateMedicineDto } from './dto/create-medicine.dto';
import { QueryMedicinesDto, SearchMedicinesDto } from './dto/query-medicines.dto';
import { AddBarcodeDto, ChangeStatusDto, CheckDuplicateDto } from './dto/misc.dto';

@Controller('medicines')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MedicinesController {
  constructor(private readonly service: MedicinesService) {}

  @Get()
  @Roles('super_admin', 'admin', 'pharmacist', 'inventory_manager', 'cashier', 'accountant', 'auditor')
  async list(@CurrentUser() user: AuthenticatedUser, @Query() dto: QueryMedicinesDto): Promise<ControllerResult<unknown>> {
    const result = await this.service.list(user, dto);
    return { data: result.data, message: 'Medicines fetched successfully', meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } };
  }

  @Get('search')
  @Roles('super_admin', 'admin', 'pharmacist', 'inventory_manager', 'cashier', 'accountant', 'auditor')
  async search(@CurrentUser() user: AuthenticatedUser, @Query() dto: SearchMedicinesDto): Promise<ControllerResult<unknown>> {
    const data = await this.service.search(user, dto);
    return { data, message: 'Search results fetched successfully' };
  }

  @Post('check-duplicate')
  @Roles('super_admin', 'admin', 'pharmacist', 'inventory_manager')
  async checkDuplicate(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckDuplicateDto): Promise<ControllerResult<unknown>> {
    const data = await this.service.checkDuplicate(user, dto);
    return { data, message: 'Duplicate check complete' };
  }

  @Get(':id')
  @Roles('super_admin', 'admin', 'pharmacist', 'inventory_manager', 'cashier', 'accountant', 'auditor')
  async getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    const data = await this.service.getById(user, id);
    return { data, message: 'Medicine fetched successfully' };
  }

  @Get(':id/price-history')
  @Roles('super_admin', 'admin', 'pharmacist', 'inventory_manager', 'accountant', 'auditor')
  async priceHistory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    const data = await this.service.getPriceHistory(user, id);
    return { data, message: 'Price history fetched successfully' };
  }

  @Post()
  @Roles('super_admin', 'admin', 'pharmacist', 'inventory_manager')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMedicineDto): Promise<ControllerResult<unknown>> {
    const data = await this.service.create(user, dto);
    return { data, message: 'Medicine created successfully' };
  }

  @Put(':id')
  @Roles('super_admin', 'admin', 'pharmacist', 'inventory_manager')
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateMedicineDto): Promise<ControllerResult<unknown>> {
    const data = await this.service.update(user, id, dto);
    return { data, message: 'Medicine updated successfully' };
  }

  @Patch(':id/status')
  @Roles('super_admin', 'admin', 'inventory_manager')
  async changeStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ChangeStatusDto): Promise<ControllerResult<unknown>> {
    const data = await this.service.changeStatus(user, id, dto);
    return { data, message: 'Status updated successfully' };
  }

  @Post(':id/archive')
  @Roles('super_admin', 'admin', 'inventory_manager')
  async archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    const data = await this.service.archive(user, id);
    return { data, message: 'Medicine archived successfully' };
  }

  @Delete(':id')
  @Roles('super_admin', 'admin')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    const data = await this.service.hardDelete(user, id);
    return { data, message: 'Medicine deleted successfully' };
  }

  @Post(':id/barcodes')
  @Roles('super_admin', 'admin', 'inventory_manager')
  async addBarcode(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AddBarcodeDto): Promise<ControllerResult<unknown>> {
    const data = await this.service.addBarcode(user, id, dto);
    return { data, message: 'Barcode added successfully' };
  }

  @Delete(':id/barcodes/:barcodeId')
  @Roles('super_admin', 'admin', 'inventory_manager')
  async removeBarcode(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('barcodeId') barcodeId: string): Promise<ControllerResult<unknown>> {
    const data = await this.service.removeBarcode(user, id, barcodeId);
    return { data, message: 'Barcode removed successfully' };
  }
}
