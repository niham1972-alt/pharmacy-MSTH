import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { CustomersService } from './customers.service';
import { CreateTagDto } from './dto/customers.dto';

const READ = ['super_admin', 'admin', 'pharmacist', 'accountant', 'auditor'] as const;
const WRITE = ['super_admin', 'admin', 'pharmacist'] as const;

@Controller('customer-tags')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerTagsController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @Roles(...READ)
  async list(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.customers.listTags(user), message: 'Tags fetched' };
  }

  @Post()
  @Roles(...WRITE)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTagDto): Promise<ControllerResult<unknown>> {
    return { data: await this.customers.createTag(user, dto), message: 'Tag created' };
  }

  @Delete(':tagId')
  @Roles(...WRITE)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('tagId') tagId: string): Promise<ControllerResult<unknown>> {
    return { data: await this.customers.deleteTag(user, tagId), message: 'Tag deleted' };
  }
}
