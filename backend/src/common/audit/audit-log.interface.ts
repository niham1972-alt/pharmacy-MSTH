export interface AuditLogEntry {
  pharmacyId: string;
  branchId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogEntryRecord extends AuditLogEntry {
  id: string;
  createdAt: Date;
}

/**
 * Calling contract finalized in Module 1, full implementation (retention,
 * export, tamper-evidence, etc.) lands in Module 15. Every write/critical-read
 * action across the system should depend on this interface, not a concrete class.
 */
export abstract class AuditLogService {
  abstract record(entry: AuditLogEntry): Promise<void>;
  abstract findRecent(
    pharmacyId: string,
    branchId: string | undefined,
    limit: number,
    cursor?: string,
  ): Promise<AuditLogEntryRecord[]>;
}
