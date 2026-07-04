import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class SalesEventsEmitter {
  constructor(private readonly emitter: EventEmitter2) {}

  saleCreated(p: { pharmacyId: string; branchId: string; saleId: string; grandTotal: number; medicineIds: string[]; actorId: string }) {
    this.emitter.emit('sale.created', p);
  }
  saleVoided(p: { pharmacyId: string; branchId: string; saleId: string; actorId: string }) {
    this.emitter.emit('sale.voided', p);
  }
  sessionOpened(p: { pharmacyId: string; branchId: string; sessionId: string; cashierId: string }) {
    this.emitter.emit('session.opened', p);
  }
  sessionClosed(p: { pharmacyId: string; branchId: string; sessionId: string; cashierId: string }) {
    this.emitter.emit('session.closed', p);
  }
}
