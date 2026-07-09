import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { SettingsService } from './settings.service';
import { ResetSettingDto, UpdateSettingDto } from './dto/settings.dto';

const READ = ['super_admin', 'admin', 'auditor'] as const;
const WRITE = ['super_admin', 'admin', 'inventory_manager'] as const; // inventory_manager narrowed to Purchases below

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @Roles(...READ)
  async list(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.settings.listGrouped(user.pharmacyId, branchId), message: 'Settings fetched' };
  }

  @Get('definitions')
  @Roles('super_admin', 'admin')
  async definitions(): Promise<ControllerResult<unknown>> {
    return { data: await this.settings.getDefinitions(), message: 'Setting definitions fetched' };
  }

  @Get(':key/history')
  @Roles(...READ)
  async history(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string): Promise<ControllerResult<unknown>> {
    return { data: await this.settings.history(user.pharmacyId, key), message: 'Setting history fetched' };
  }

  @Get(':key')
  @Roles(...READ)
  async getOne(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string, @Query('branchId') branchId?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.settings.get(key, { pharmacyId: user.pharmacyId, branchId }), message: 'Setting value fetched' };
  }

  @Put(':key')
  @Roles(...WRITE)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string, @Body() dto: UpdateSettingDto): Promise<ControllerResult<unknown>> {
    this.assertCanWrite(user, key);
    await this.settings.set(key, dto.value, { pharmacyId: user.pharmacyId, branchId: dto.branchId, updatedBy: user.userId });
    return { data: await this.settings.get(key, { pharmacyId: user.pharmacyId, branchId: dto.branchId }), message: 'Setting updated' };
  }

  @Post(':key/reset')
  @Roles(...WRITE)
  async reset(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string, @Body() dto: ResetSettingDto): Promise<ControllerResult<unknown>> {
    this.assertCanWrite(user, key);
    await this.settings.resetToDefault(key, { pharmacyId: user.pharmacyId, branchId: dto.branchId, updatedBy: user.userId });
    return { data: { key, reset: true }, message: 'Setting reset to default' };
  }

  /** inventory_manager may only edit Purchases-category settings (spec §13). */
  private assertCanWrite(user: AuthenticatedUser, key: string): void {
    if (user.role === 'inventory_manager' && this.settings.categoryOf(key) !== 'Purchases') {
      throw new ForbiddenException({ errorCode: 'SETTING_FORBIDDEN', message: 'You may only edit Purchases settings.' });
    }
  }
}
