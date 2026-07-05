import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class BatchEventsEmitter {
  constructor(private readonly emitter: EventEmitter2) {}

  created(p: { pharmacyId: string; branchId: string; batchId: string; medicineId: string }) {
    this.emitter.emit('batch.created', p);
  }
  recalled(p: { pharmacyId: string; branchId: string; batchId: string }) {
    this.emitter.emit('batch.recalled', p);
  }
  writtenOff(p: { pharmacyId: string; branchId: string; batchId: string; quantity: number }) {
    this.emitter.emit('batch.written-off', p);
  }
}
