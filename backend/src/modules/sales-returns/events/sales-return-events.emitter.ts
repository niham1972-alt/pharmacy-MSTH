import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class SalesReturnEventsEmitter {
  constructor(private readonly emitter: EventEmitter2) {}

  /** Dashboard/Reports invalidate on this; stock already emitted its own event. */
  returnCreated(p: { pharmacyId: string; branchId: string; salesReturnId: string; originalSaleId: string; totalRefundAmount: number; medicineIds: string[]; actorId: string }) {
    this.emitter.emit('return.created', p);
  }

  storeCreditIssued(p: { pharmacyId: string; customerId: string; amount: number; balanceAfter: number; salesReturnId: string }) {
    this.emitter.emit('store-credit.issued', p);
  }
}
