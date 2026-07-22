import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { ExpenseCategoriesService } from './expense-categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/expense-category.dto';

// Category management is admin-only (spec §13); accountant/auditor may read the list.
const READ = ['super_admin', 'admin', 'accountant', 'auditor'] as const;
const MANAGE = ['super_admin', 'admin'] as const;

@Controller('expense-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpenseCategoriesController {
  constructor(private readonly service: ExpenseCategoriesService) {}

  @Get()
  @Roles(...READ)
  async list(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.service.list(user), message: 'Expense categories' };
  }

  @Post()
  @Roles(...MANAGE)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCategoryDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.create(user, dto), message: 'Category created' };
  }

  @Put(':id')
  @Roles(...MANAGE)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateCategoryDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.update(user, id, dto), message: 'Category updated' };
  }

  @Delete(':id')
  @Roles(...MANAGE)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.remove(user, id), message: 'Category removed' };
  }
}
