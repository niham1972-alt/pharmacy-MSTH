import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DashboardCacheService } from '../cache/dashboard-cache.service';
import { branchInvalidationPattern } from '../cache/cache-keys.util';

/**
 * Integration seam (spec §8/§15/§24): future modules (Sales/POS, Purchases,
 * Inventory, Expenses) emit these domain events via NestJS `EventEmitter2`
 * once they exist. Until then, nothing emits them — this listener is here so
 * wiring a real emitter later is a zero-change drop-in.
 */
export interface CacheInvalidatingEvent {
  pharmacyId: string;
  branchId: string;
}

@Injectable()
export class DashboardInvalidateListener {
  constructor(private readonly cache: DashboardCacheService) {}

  @OnEvent('sale.created')
  @OnEvent('sale.voided')
  @OnEvent('purchase.received')
  @OnEvent('stock.adjusted')
  @OnEvent('expense.created')
  async handleInvalidatingEvent(event: CacheInvalidatingEvent): Promise<void> {
    await this.cache.invalidate(branchInvalidationPattern(event.pharmacyId, event.branchId));
  }
}
