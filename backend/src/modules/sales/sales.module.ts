import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { CashierSessionsController } from './cashier-sessions.controller';
import { SalesService } from './sales.service';
import { CashierSessionsService } from './cashier-sessions.service';
import { SalesRepository } from './sales.repository';
import { SalesEventsEmitter } from './events/sales-events.emitter';
import { BatchFefoService } from './integrations/batch-fefo.service';
import { InventoryDecrementService } from './integrations/inventory-decrement.service';

@Module({
  controllers: [SalesController, CashierSessionsController],
  providers: [SalesService, CashierSessionsService, SalesRepository, SalesEventsEmitter, BatchFefoService, InventoryDecrementService],
})
export class SalesModule {}
