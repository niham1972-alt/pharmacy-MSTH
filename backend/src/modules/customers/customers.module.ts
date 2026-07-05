import { Global, Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { HealthProfileController } from './health-profile.controller';
import { PrescriptionsController } from './prescriptions.controller';
import { CustomerTagsController } from './customer-tags.controller';
import { CustomersService } from './customers.service';
import { HealthProfileService } from './health-profile.service';
import { PrescriptionsService } from './prescriptions.service';
import { MergeService } from './merge.service';
import { CustomerEventsEmitter } from './events/customer-events.emitter';

/**
 * @Global so `CustomersService` (search / quick-add) can be reused by Module 4's
 * POS. Health-adjacent data lives behind a SEPARATE service + controller
 * (HealthProfileService / HealthProfileController) gated to admin/pharmacist —
 * this module carries the system's highest privacy posture (see README).
 */
@Global()
@Module({
  controllers: [CustomersController, HealthProfileController, PrescriptionsController, CustomerTagsController],
  providers: [CustomersService, HealthProfileService, PrescriptionsService, MergeService, CustomerEventsEmitter],
  exports: [CustomersService],
})
export class CustomersModule {}
