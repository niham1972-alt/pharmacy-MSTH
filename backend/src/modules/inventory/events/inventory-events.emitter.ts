import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class InventoryEventsEmitter {
  constructor(private readonly emitter: EventEmitter2) {}

  stockUpdated(p: { pharmacyId: string; branchId: string; medicineId: string; currentStock: number }) {
    this.emitter.emit('stock.updated', p);
  }
  transferCompleted(p: { pharmacyId: string; transferId: string }) {
    this.emitter.emit('transfer.completed', p);
  }
}
