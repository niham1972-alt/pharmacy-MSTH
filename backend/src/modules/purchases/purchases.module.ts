import { Module } from '@nestjs/common';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { GoodsReceiptsController } from './goods-receipts.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { GoodsReceiptsService } from './goods-receipts.service';
import { PurchasePaymentsService } from './purchase-payments.service';
import { PurchasesRepository } from './purchases.repository';
import { PurchaseConfigService } from './purchase-config.service';
import { PurchaseEventsEmitter } from './events/purchase-events.emitter';
import { BatchSyncService } from './integrations/batch-sync.service';
import { InventorySyncService } from './integrations/inventory-sync.service';
import { MedicineCostSyncService } from './integrations/medicine-cost-sync.service';

@Module({
  controllers: [PurchaseOrdersController, GoodsReceiptsController],
  providers: [
    PurchaseOrdersService,
    GoodsReceiptsService,
    PurchasePaymentsService,
    PurchasesRepository,
    PurchaseConfigService,
    PurchaseEventsEmitter,
    BatchSyncService,
    InventorySyncService,
    MedicineCostSyncService,
  ],
})
export class PurchasesModule {}
