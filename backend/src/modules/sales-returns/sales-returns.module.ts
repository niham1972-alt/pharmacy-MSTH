import { Module } from '@nestjs/common';
import { BatchesModule } from '../batches/batches.module';
import { SalesModule } from '../sales/sales.module';
import { SalesReturnsController } from './sales-returns.controller';
import { StoreCreditController } from './store-credit.controller';
import { SalesReturnsService } from './sales-returns.service';
import { SalesReturnsRepository } from './sales-returns.repository';
import { StoreCreditService } from './store-credit.service';
import { InventoryRestoreService } from './integrations/inventory-restore.service';
import { SaleStatusSyncService } from './integrations/sale-status-sync.service';
import { BatchWriteoffTriggerService } from './integrations/batch-writeoff-trigger.service';
import { SalesReturnEventsEmitter } from './events/sales-return-events.emitter';

/**
 * Module 10 — Sales Returns. Imports Module 6 (BatchesService, for batch-aware
 * stock restoration) and Module 4 (SalesService, for the narrow status-sync).
 * SettingsService (M18) and AuditLogService (M15) are globally provided.
 */
@Module({
  imports: [BatchesModule, SalesModule],
  controllers: [SalesReturnsController, StoreCreditController],
  providers: [SalesReturnsService, SalesReturnsRepository, StoreCreditService, InventoryRestoreService, SaleStatusSyncService, BatchWriteoffTriggerService, SalesReturnEventsEmitter],
})
export class SalesReturnsModule {}
