import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { MedicineLookupsService } from './medicine-lookups.service';
import { CategoryDto, DosageFormDto, ManufacturerDto, RackDto, UnitDto } from './dto/lookup.dto';

const READ_ROLES = ['super_admin', 'admin', 'pharmacist', 'inventory_manager', 'cashier', 'accountant', 'auditor'] as const;
const WRITE_ROLES = ['super_admin', 'admin', 'inventory_manager'] as const;

@Controller('medicine-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly service: MedicineLookupsService) {}

  @Get()
  @Roles(...READ_ROLES)
  async list(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.service.categories(user.pharmacyId), message: 'Categories fetched' };
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CategoryDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.createCategory(user, dto), message: 'Category created' };
  }

  @Put(':id')
  @Roles(...WRITE_ROLES)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CategoryDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.updateCategory(user, id, dto), message: 'Category updated' };
  }

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.deleteCategory(user, id), message: 'Category deleted' };
  }
}

@Controller('medicine-manufacturers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ManufacturersController {
  constructor(private readonly service: MedicineLookupsService) {}

  @Get()
  @Roles(...READ_ROLES)
  async list(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.service.manufacturers(user.pharmacyId), message: 'Manufacturers fetched' };
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: ManufacturerDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.createManufacturer(user, dto), message: 'Manufacturer created' };
  }

  @Put(':id')
  @Roles(...WRITE_ROLES)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ManufacturerDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.updateManufacturer(user, id, dto), message: 'Manufacturer updated' };
  }

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.deleteManufacturer(user, id), message: 'Manufacturer deleted' };
  }
}

@Controller('medicine-dosage-forms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DosageFormsController {
  constructor(private readonly service: MedicineLookupsService) {}

  @Get()
  @Roles(...READ_ROLES)
  async list(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.service.dosageForms(user.pharmacyId), message: 'Dosage forms fetched' };
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: DosageFormDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.createDosageForm(user, dto), message: 'Dosage form created' };
  }

  @Put(':id')
  @Roles(...WRITE_ROLES)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: DosageFormDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.updateDosageForm(user, id, dto), message: 'Dosage form updated' };
  }

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.deleteDosageForm(user, id), message: 'Dosage form deleted' };
  }
}

@Controller('medicine-units')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnitsController {
  constructor(private readonly service: MedicineLookupsService) {}

  @Get()
  @Roles(...READ_ROLES)
  async list(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.service.units(user.pharmacyId), message: 'Units fetched' };
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: UnitDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.createUnit(user, dto), message: 'Unit created' };
  }

  @Put(':id')
  @Roles(...WRITE_ROLES)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UnitDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.updateUnit(user, id, dto), message: 'Unit updated' };
  }

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.deleteUnit(user, id), message: 'Unit deleted' };
  }
}

@Controller('medicine-racks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RacksController {
  constructor(private readonly service: MedicineLookupsService) {}

  @Get()
  @Roles(...READ_ROLES)
  async list(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.service.racks(user.pharmacyId), message: 'Racks fetched' };
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: RackDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.createRack(user, dto), message: 'Rack created' };
  }

  @Put(':id')
  @Roles(...WRITE_ROLES)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RackDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.updateRack(user, id, dto), message: 'Rack updated' };
  }

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.deleteRack(user, id), message: 'Rack deleted' };
  }
}
