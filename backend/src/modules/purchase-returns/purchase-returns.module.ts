import { Module } from '@nestjs/common';
import { BatchesModule } from '../batches/batches.module';
import { PurchaseReturnsController } from './purchase-returns.controller';
import { PurchaseReturnsService } from './purchase-returns.service';
import { PurchaseReturnsRepository } from './purchase-returns.repository';
import { InventoryRemovalService } from './integrations/inventory-removal.service';
import { PurchaseReturnEventsEmitter } from './events/purchase-return-events.emitter';

/**
 * Module 9 — Purchase Returns. Imports Module 6 (BatchesService) for batch-aware
 * stock removal. SettingsService (M18) and AuditLogService (M15) are global.
 */
@Module({
  imports: [BatchesModule],
  controllers: [PurchaseReturnsController],
  providers: [PurchaseReturnsService, PurchaseReturnsRepository, InventoryRemovalService, PurchaseReturnEventsEmitter],
})
export class PurchaseReturnsModule {}
