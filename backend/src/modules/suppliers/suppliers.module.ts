import { Global, Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { PreferredSuppliersController } from './preferred-suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { SupplierPerformanceService } from './supplier-performance.service';
import { SupplierEventsEmitter } from './events/supplier-events.emitter';

/**
 * @Global so `SuppliersService.currentPrice` / `preferredForMedicine` can be
 * consumed by Module 3 (PO negotiated-price pre-fill) and Module 5 (reorder →
 * PO deep-link supplier pre-select) without importing this module explicitly.
 */
@Global()
@Module({
  controllers: [SuppliersController, PreferredSuppliersController],
  providers: [SuppliersService, SupplierPerformanceService, SupplierEventsEmitter],
  exports: [SuppliersService],
})
export class SuppliersModule {}
