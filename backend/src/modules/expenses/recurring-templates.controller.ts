import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { RecurringTemplatesService } from './recurring-templates.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/create-template.dto';

// Templates: admin + accountant manage them (spec §13); auditor may view.
const VIEW = ['super_admin', 'admin', 'accountant', 'auditor'] as const;
const MANAGE = ['super_admin', 'admin', 'accountant'] as const;

@Controller('recurring-expense-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecurringTemplatesController {
  constructor(private readonly service: RecurringTemplatesService) {}

  @Get()
  @Roles(...VIEW)
  async list(@CurrentUser() user: AuthenticatedUser, @Query('includeInactive') includeInactive?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.list(user, includeInactive !== 'false'), message: 'Recurring templates' };
  }

  @Post()
  @Roles(...MANAGE)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTemplateDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.create(user, dto), message: 'Template created' };
  }

  /** Manual generation trigger — also the seam an external scheduler can hit. */
  @Post('run-generation')
  @Roles(...MANAGE)
  async runGeneration(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.service.runGeneration(user), message: 'Recurring expense generation run' };
  }

  @Put(':id')
  @Roles(...MANAGE)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateTemplateDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.update(user, id, dto), message: 'Template updated' };
  }

  @Post(':id/pause')
  @Roles(...MANAGE)
  async pause(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.setActive(user, id, false), message: 'Template paused' };
  }

  @Post(':id/resume')
  @Roles(...MANAGE)
  async resume(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.setActive(user, id, true), message: 'Template resumed' };
  }

  @Post(':id/end')
  @Roles(...MANAGE)
  async end(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.end(user, id), message: 'Template ended' };
  }
}
