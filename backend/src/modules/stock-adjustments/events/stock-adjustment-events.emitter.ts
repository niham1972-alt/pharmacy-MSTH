import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface AdjustmentEvent {
  pharmacyId: string;
  branchId: string;
  adjustmentId: string;
  medicineId: string;
  actorId: string;
}

@Injectable()
export class StockAdjustmentEventsEmitter {
  constructor(private readonly emitter: EventEmitter2) {}

  created(p: AdjustmentEvent) {
    this.emitter.emit('adjustment.created', p);
  }
  approved(p: AdjustmentEvent) {
    this.emitter.emit('adjustment.approved', p);
  }
  rejected(p: AdjustmentEvent) {
    this.emitter.emit('adjustment.rejected', p);
  }
}
