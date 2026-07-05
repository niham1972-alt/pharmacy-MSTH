import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class SupplierEventsEmitter {
  constructor(private readonly emitter: EventEmitter2) {}

  created(p: { pharmacyId: string; supplierId: string }) {
    this.emitter.emit('supplier.created', p);
  }
  archived(p: { pharmacyId: string; supplierId: string }) {
    this.emitter.emit('supplier.archived', p);
  }
  documentExpiring(p: { pharmacyId: string; supplierId: string; documentId: string }) {
    this.emitter.emit('supplier.document-expiring', p);
  }
}
