import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { CashierSessionsController } from './cashier-sessions.controller';
import { SalesService } from './sales.service';
import { CashierSessionsService } from './cashier-sessions.service';
import { SalesRepository } from './sales.repository';
import { SalesEventsEmitter } from './events/sales-events.emitter';

@Module({
  controllers: [SalesController, CashierSessionsController],
  providers: [SalesService, CashierSessionsService, SalesRepository, SalesEventsEmitter],
})
export class SalesModule {}
