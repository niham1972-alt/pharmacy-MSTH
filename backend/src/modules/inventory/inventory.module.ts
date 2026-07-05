import { Global, Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryReadService } from './inventory-read.service';
import { ReconciliationService } from './reconciliation.service';
import { StockTransfersService } from './stock-transfers.service';
import { InventoryEventsEmitter } from './events/inventory-events.emitter';

/**
 * @Global so the `InventoryService` contract (the ONLY permitted stock mutator)
 * is injectable from Purchases (GRN), Sales (finalize/void) and future Returns/
 * Adjustment modules without each importing this module explicitly.
 */
@Global()
@Module({
  controllers: [InventoryController],
  providers: [InventoryService, InventoryReadService, ReconciliationService, StockTransfersService, InventoryEventsEmitter],
  exports: [InventoryService],
})
export class InventoryModule {}
