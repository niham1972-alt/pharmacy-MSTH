import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.interface';
import { PrismaAuditLogService } from './audit-log.service.impl';

@Global()
@Module({
  providers: [{ provide: AuditLogService, useClass: PrismaAuditLogService }],
  exports: [AuditLogService],
})
export class AuditLogModule {}
