import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { DashboardService } from './dashboard.service';
import { GetSummaryDto } from './dto/get-summary.dto';
import { GetSalesTrendDto } from './dto/get-sales-trend.dto';
import { GetTopSellingDto } from './dto/get-top-selling.dto';
import { GetAlertsDto } from './dto/get-alerts.dto';
import { AcknowledgeAlertDto } from './dto/acknowledge-alert.dto';
import { GetActivityFeedDto } from './dto/get-activity-feed.dto';
import { GetPurchaseSnapshotDto } from './dto/get-purchase-snapshot.dto';
import { GetCashSummaryDto } from './dto/get-cash-summary.dto';
import { SavePreferencesDto } from './dto/save-preferences.dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles('super_admin', 'admin', 'pharmacist', 'inventory_manager', 'cashier', 'accountant', 'auditor')
  async getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: GetSummaryDto,
  ): Promise<ControllerResult<unknown>> {
    const data = await this.dashboardService.getSummary(user, dto);
    return { data, message: 'Dashboard summary fetched successfully', meta: { branchId: dto.branchId ?? user.branchId, generatedAt: new Date().toISOString() } };
  }

  @Get('sales-trend')
  @Roles('super_admin', 'admin', 'pharmacist', 'cashier', 'accountant', 'auditor')
  async getSalesTrend(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: GetSalesTrendDto,
  ): Promise<ControllerResult<unknown>> {
    const data = await this.dashboardService.getSalesTrend(user, dto);
    return { data, message: 'Sales trend fetched successfully' };
  }

  @Get('top-selling')
  @Roles('super_admin', 'admin', 'pharmacist', 'inventory_manager', 'accountant', 'auditor')
  async getTopSelling(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: GetTopSellingDto,
  ): Promise<ControllerResult<unknown>> {
    const data = await this.dashboardService.getTopSelling(user, dto);
    return { data, message: 'Top selling medicines fetched successfully' };
  }

  @Get('alerts')
  @Roles('super_admin', 'admin', 'pharmacist', 'inventory_manager', 'auditor')
  async getAlerts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: GetAlertsDto,
  ): Promise<ControllerResult<unknown>> {
    const data = await this.dashboardService.getAlerts(user, dto);
    return { data, message: 'Alerts fetched successfully' };
  }

  @Post('alerts/:id/acknowledge')
  @Roles('super_admin', 'admin', 'pharmacist', 'inventory_manager')
  async acknowledgeAlert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AcknowledgeAlertDto,
  ): Promise<ControllerResult<null>> {
    await this.dashboardService.acknowledgeAlert(user, id, dto);
    return { data: null, message: 'Alert acknowledged' };
  }

  @Get('activity-feed')
  @Roles('super_admin', 'admin', 'pharmacist', 'inventory_manager', 'cashier', 'accountant', 'auditor')
  async getActivityFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: GetActivityFeedDto,
  ): Promise<ControllerResult<unknown>> {
    const data = await this.dashboardService.getActivityFeed(user, dto);
    return { data, message: 'Activity feed fetched successfully' };
  }

  @Get('purchase-snapshot')
  @Roles('super_admin', 'admin', 'inventory_manager', 'accountant', 'auditor')
  async getPurchaseSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: GetPurchaseSnapshotDto,
  ): Promise<ControllerResult<unknown>> {
    const data = await this.dashboardService.getPurchaseSnapshot(user, dto);
    return { data, message: 'Purchase snapshot fetched successfully' };
  }

  @Get('cash-summary')
  @Roles('super_admin', 'admin', 'cashier', 'accountant', 'auditor')
  async getCashSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: GetCashSummaryDto,
  ): Promise<ControllerResult<unknown>> {
    const data = await this.dashboardService.getCashSummary(user, dto);
    return { data, message: 'Cash summary fetched successfully' };
  }

  @Get('preferences')
  @Roles('super_admin', 'admin', 'pharmacist', 'inventory_manager', 'cashier', 'accountant', 'auditor')
  async getPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
  ): Promise<ControllerResult<unknown>> {
    const data = await this.dashboardService.getPreferences(user, branchId);
    return { data, message: 'Preferences fetched successfully' };
  }

  @Put('preferences')
  @Roles('super_admin', 'admin', 'pharmacist', 'inventory_manager', 'cashier', 'accountant', 'auditor')
  async savePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SavePreferencesDto,
  ): Promise<ControllerResult<null>> {
    await this.dashboardService.savePreferences(user, dto);
    return { data: null, message: 'Preferences saved successfully' };
  }

  @Get('export')
  @Roles('super_admin', 'admin', 'accountant')
  exportSnapshot(): ControllerResult<null> {
    this.dashboardService.exportSnapshot();
    return { data: null, message: 'Export not yet available' };
  }
}
