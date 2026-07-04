import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './dashboard.repository';
import { DashboardCacheService } from './cache/dashboard-cache.service';
import { DashboardInvalidateListener } from './events/dashboard-invalidate.listener';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository, DashboardCacheService, DashboardInvalidateListener],
})
export class DashboardModule {}
