import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class CustomerEventsEmitter {
  constructor(private readonly emitter: EventEmitter2) {}

  created(p: { pharmacyId: string; customerId: string; via: 'quick_add' | 'full_create' }) {
    this.emitter.emit('customer.created', p);
  }
  merged(p: { pharmacyId: string; survivingId: string; mergedAwayId: string }) {
    this.emitter.emit('customer.merged', p);
  }
  healthProfileUpdated(p: { pharmacyId: string; customerId: string }) {
    this.emitter.emit('health-profile.updated', p);
  }
}
