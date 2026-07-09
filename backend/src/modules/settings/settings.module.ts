import { Global, Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

/**
 * @Global so `SettingsService` (the cached config read path) is injectable from
 * every module without importing this one — the same pattern as Module 5's
 * InventoryService, Module 15's AuditLogService, Module 16's AuthorizationService.
 */
@Global()
@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
