import { Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';

/**
 * Module 15 query/export/integrity surface. The write side (`record()`) lives in
 * the @Global `AuditLogModule` (common/audit) that every module already imports;
 * this module only adds the read/investigation endpoints. No update/delete
 * endpoint exists anywhere for audit records — that absence is the safeguard.
 */
@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsService],
})
export class AuditLogsModule {}
