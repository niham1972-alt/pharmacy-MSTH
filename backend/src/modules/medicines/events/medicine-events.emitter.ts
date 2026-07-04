import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Domain events other modules subscribe to (Inventory seeds a stock ledger row,
 * Dashboard invalidates top-selling/KPI caches). This is the integration seam —
 * consumers listen via `@OnEvent('medicine.created')` etc.
 */
export interface MedicineEventPayload {
  pharmacyId: string;
  branchId: string | null;
  medicineId: string;
  actorId: string;
}

@Injectable()
export class MedicineEventsEmitter {
  constructor(private readonly emitter: EventEmitter2) {}

  created(payload: MedicineEventPayload) {
    this.emitter.emit('medicine.created', payload);
  }

  updated(payload: MedicineEventPayload) {
    this.emitter.emit('medicine.updated', payload);
  }

  priceChanged(payload: MedicineEventPayload & { priceTypes: string[] }) {
    this.emitter.emit('medicine.price-changed', payload);
  }

  statusChanged(payload: MedicineEventPayload & { status: string }) {
    this.emitter.emit('medicine.status-changed', payload);
  }

  archived(payload: MedicineEventPayload) {
    this.emitter.emit('medicine.archived', payload);
  }
}
