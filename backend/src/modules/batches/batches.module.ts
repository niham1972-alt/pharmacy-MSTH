import { Global, Module } from '@nestjs/common';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';
import { WriteOffsService } from './write-offs.service';
import { RecallsService } from './recalls.service';
import { BatchEventsEmitter } from './events/batch-events.emitter';

/**
 * @Global so the `BatchesService` contract (createOrAppendBatch /
 * getFefoAllocation / allocateAndConsume / isBatchSellable) is injectable from
 * Purchases (GRN) and Sales (finalize/void) without importing this module. It
 * depends on Module 5's global `InventoryService` for every quantity change.
 */
@Global()
@Module({
  controllers: [BatchesController],
  providers: [BatchesService, WriteOffsService, RecallsService, BatchEventsEmitter],
  exports: [BatchesService],
})
export class BatchesModule {}
