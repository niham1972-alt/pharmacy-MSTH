import { Module } from '@nestjs/common';
import { StockAdjustmentsController } from './stock-adjustments.controller';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { StockAdjustmentsRepository } from './stock-adjustments.repository';
import { InventoryAdjustmentService } from './integrations/inventory-adjustment.service';
import { StockAdjustmentEventsEmitter } from './events/stock-adjustment-events.emitter';

/**
 * Module 11 — Stock Adjustment. Depends on the @Global InventoryService (Module 5,
 * the only permitted stock mutator) and @Global SettingsService (Module 18,
 * approval threshold). No local stock table — all stock effects go through Module 5.
 */
@Module({
  controllers: [StockAdjustmentsController],
  providers: [StockAdjustmentsService, StockAdjustmentsRepository, InventoryAdjustmentService, StockAdjustmentEventsEmitter],
})
export class StockAdjustmentsModule {}
