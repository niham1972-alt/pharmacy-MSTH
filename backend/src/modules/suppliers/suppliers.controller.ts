import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { SuppliersService } from './suppliers.service';
import { SupplierPerformanceService } from './supplier-performance.service';
import { AddAddressDto, AddContactDto, CreateSupplierDto, QuerySuppliersDto, SetNegotiatedPriceDto, UpdateSupplierDto, UploadDocumentDto } from './dto/suppliers.dto';

const READ = ['super_admin', 'admin', 'pharmacist', 'inventory_manager', 'accountant', 'auditor'] as const;
const MANAGE = ['super_admin', 'admin', 'inventory_manager'] as const;
const PAYABLES = ['super_admin', 'admin', 'accountant', 'auditor'] as const;
const PERF = ['super_admin', 'admin', 'inventory_manager', 'accountant', 'auditor'] as const;

@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliersController {
  constructor(
    private readonly suppliers: SuppliersService,
    private readonly perf: SupplierPerformanceService,
  ) {}

  @Get()
  @Roles(...READ)
  async list(@CurrentUser() user: AuthenticatedUser, @Query() q: QuerySuppliersDto): Promise<ControllerResult<unknown>> {
    const r = await this.suppliers.list(user, q);
    return { data: r.data, message: 'Suppliers fetched', meta: { page: r.page, limit: r.limit, total: r.total, totalPages: r.totalPages } };
  }

  // --- Specific routes before :id -----------------------------------------
  @Get('active')
  @Roles(...READ)
  async active(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.suppliers.activeList(user), message: 'Active suppliers fetched' };
  }

  @Get('needing-attention')
  @Roles(...MANAGE, 'auditor')
  async needingAttention(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.suppliers.needingAttention(user), message: 'Suppliers needing attention fetched' };
  }

  @Get('payables-summary')
  @Roles(...PAYABLES)
  async payablesSummary(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.perf.payablesSummary(user.pharmacyId), message: 'Payables summary fetched' };
  }

  @Post()
  @Roles(...MANAGE)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSupplierDto): Promise<ControllerResult<unknown>> {
    return { data: await this.suppliers.create(user, dto), message: 'Supplier created' };
  }

  @Get(':id')
  @Roles(...READ)
  async detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.suppliers.detail(user, id), message: 'Supplier fetched' };
  }

  @Put(':id')
  @Roles(...MANAGE)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateSupplierDto): Promise<ControllerResult<unknown>> {
    return { data: await this.suppliers.update(user, id, dto), message: 'Supplier updated' };
  }

  @Post(':id/archive')
  @Roles(...MANAGE)
  async archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.suppliers.archive(user, id), message: 'Supplier archived' };
  }

  @Delete(':id')
  @Roles('super_admin', 'admin')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.suppliers.hardDelete(user, id), message: 'Supplier deleted' };
  }

  // --- Contacts ------------------------------------------------------------
  @Post(':id/contacts')
  @Roles(...MANAGE)
  async addContact(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AddContactDto): Promise<ControllerResult<unknown>> {
    return { data: await this.suppliers.addContact(user, id, dto), message: 'Contact added' };
  }

  @Put(':id/contacts/:contactId')
  @Roles(...MANAGE)
  async updateContact(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('contactId') contactId: string, @Body() dto: AddContactDto): Promise<ControllerResult<unknown>> {
    return { data: await this.suppliers.updateContact(user, id, contactId, dto), message: 'Contact updated' };
  }

  @Delete(':id/contacts/:contactId')
  @Roles(...MANAGE)
  async removeContact(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('contactId') contactId: string): Promise<ControllerResult<unknown>> {
    return { data: await this.suppliers.removeContact(user, id, contactId), message: 'Contact removed' };
  }

  // --- Addresses / documents ----------------------------------------------
  @Post(':id/addresses')
  @Roles(...MANAGE)
  async addAddress(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AddAddressDto): Promise<ControllerResult<unknown>> {
    return { data: await this.suppliers.addAddress(user, id, dto), message: 'Address added' };
  }

  @Post(':id/documents')
  @Roles(...MANAGE)
  async addDocument(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UploadDocumentDto): Promise<ControllerResult<unknown>> {
    return { data: await this.suppliers.addDocument(user, id, dto), message: 'Document uploaded' };
  }

  @Get(':id/documents/expiring')
  @Roles(...MANAGE, 'auditor')
  async expiringDocs(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Query('thresholdDays') thresholdDays?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.suppliers.expiringDocuments(user, id, thresholdDays ? Number(thresholdDays) : undefined), message: 'Expiring documents fetched' };
  }

  // --- Pricing -------------------------------------------------------------
  @Post(':id/pricing')
  @Roles(...MANAGE)
  async setPrice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SetNegotiatedPriceDto): Promise<ControllerResult<unknown>> {
    return { data: await this.suppliers.setPrice(user, id, dto), message: 'Negotiated price set' };
  }

  @Get(':id/pricing')
  @Roles('super_admin', 'admin', 'pharmacist', 'inventory_manager')
  async listPrices(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.suppliers.listPrices(user, id), message: 'Negotiated prices fetched' };
  }

  // --- Performance / payables ---------------------------------------------
  @Get(':id/performance')
  @Roles(...PERF)
  async performance(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.perf.performance(user.pharmacyId, id), message: 'Performance fetched' };
  }

  @Get(':id/payables')
  @Roles(...PAYABLES)
  async payables(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.perf.payables(user.pharmacyId, id), message: 'Payables fetched' };
  }
}
