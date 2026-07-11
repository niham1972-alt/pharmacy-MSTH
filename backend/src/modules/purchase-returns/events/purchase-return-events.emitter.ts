import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class PurchaseReturnEventsEmitter {
  constructor(private readonly emitter: EventEmitter2) {}

  created(p: { pharmacyId: string; branchId: string; purchaseReturnId: string; originalGrnId: string; supplierId: string; expectedCreditAmount: number; medicineIds: string[]; actorId: string }) {
    this.emitter.emit('purchase-return.created', p);
  }

  settled(p: { pharmacyId: string; purchaseReturnId: string; settlementStatus: string; actualCreditedAmount?: number; actorId: string }) {
    this.emitter.emit('purchase-return.settled', p);
  }
}
