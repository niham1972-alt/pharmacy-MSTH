export type AuditSeverityLevel = 'ROUTINE' | 'SENSITIVE' | 'CRITICAL';

export interface AuditLogEntry {
  pharmacyId: string;
  branchId?: string;
  // `userId` is the calling convention every module already uses; Module 15 maps
  // it to the AuditLog.performedBy column. Kept for backward compatibility.
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  // Optional per-call severity override; defaults to the action-registry value.
  severity?: AuditSeverityLevel;
}

export interface AuditLogEntryRecord {
  id: string;
  pharmacyId: string;
  branchId?: string | null;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
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
