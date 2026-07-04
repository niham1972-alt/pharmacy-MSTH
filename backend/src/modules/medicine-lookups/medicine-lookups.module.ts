import { Module } from '@nestjs/common';
import { MedicineLookupsService } from './medicine-lookups.service';
import {
  CategoriesController,
  DosageFormsController,
  ManufacturersController,
  UnitsController,
} from './medicine-lookups.controllers';

@Module({
  controllers: [CategoriesController, ManufacturersController, DosageFormsController, UnitsController],
  providers: [MedicineLookupsService],
})
export class MedicineLookupsModule {}
