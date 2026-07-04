import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class PurchaseEventsEmitter {
  constructor(private readonly emitter: EventEmitter2) {}

  poCreated(p: { pharmacyId: string; branchId: string; purchaseOrderId: string; actorId: string }) {
    this.emitter.emit('po.created', p);
  }
  poApproved(p: { pharmacyId: string; branchId: string; purchaseOrderId: string; actorId: string }) {
    this.emitter.emit('po.approved', p);
  }
  poRejected(p: { pharmacyId: string; branchId: string; purchaseOrderId: string; actorId: string }) {
    this.emitter.emit('po.rejected', p);
  }

  /** The key stock event — Dashboard invalidates caches, Inventory (Module 5)
   * writes its ledger, Realtime pushes low-stock updates. */
  stockReceived(p: { pharmacyId: string; branchId: string; goodsReceiptId: string; medicineIds: string[]; actorId: string }) {
    this.emitter.emit('stock.received', p);
  }

  paymentRecorded(p: { pharmacyId: string; purchaseOrderId: string; amount: number; actorId: string }) {
    this.emitter.emit('po.payment-recorded', p);
  }
}
