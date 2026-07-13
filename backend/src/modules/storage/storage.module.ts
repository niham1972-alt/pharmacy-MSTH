import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { FilesController } from './files.controller';

/** @Global so any module can persist files to the VPS uploads volume via StorageService. */
@Global()
@Module({
  controllers: [FilesController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
