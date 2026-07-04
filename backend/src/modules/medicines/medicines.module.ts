import { Module } from '@nestjs/common';
import { MedicinesController } from './medicines.controller';
import { MedicinesService } from './medicines.service';
import { MedicinesRepository } from './medicines.repository';
import { MedicineEventsEmitter } from './events/medicine-events.emitter';

@Module({
  controllers: [MedicinesController],
  providers: [MedicinesService, MedicinesRepository, MedicineEventsEmitter],
  exports: [MedicinesService],
})
export class MedicinesModule {}
