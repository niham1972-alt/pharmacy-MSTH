import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class UserEventsEmitter {
  constructor(private readonly emitter: EventEmitter2) {}

  invited(p: { pharmacyId: string; userId: string }) { this.emitter.emit('user.invited', p); }
  activated(p: { pharmacyId: string; userId: string }) { this.emitter.emit('user.activated', p); }
  roleChanged(p: { pharmacyId: string; userId: string }) { this.emitter.emit('user.role-changed', p); }
  suspended(p: { pharmacyId: string; userId: string }) { this.emitter.emit('user.suspended', p); }
}
