import { apiClient } from '../../../shared/api/client';

export type AuditSeverity = 'ROUTINE' | 'SENSITIVE' | 'CRITICAL';

export interface AuditRow {
  id: string;
  createdAt: string;
  action: string;
  actionLabel: string;
  registered: boolean;
  entityType: string;
  entityId: string | null;
  performedBy: string;
  performedByName: string | null;
  severity: AuditSeverity;
  branchId: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ActionDef {
  actionKey: string;
  label: string;
  module: string;
  defaultSeverity: AuditSeverity;
}

export interface IntegrityStatus {
  totalRecords: number;
  lastCheck: { checkedAt: string; recordsChecked: number; chainIntact: boolean; brokenAtRecordId: string | null } | null;
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
}

export const auditLogsApi = {
  list: (params: Record<string, string | number | undefined | null>) => apiClient.get<AuditRow[]>(`/audit-logs${qs(params)}`),
  entity: (entityType: string, entityId: string, page = 1) => apiClient.get<AuditRow[]>(`/audit-logs/entity${qs({ entityType, entityId, page })}`),
  user: (userId: string, params: Record<string, string | number | undefined | null> = {}) => apiClient.get<AuditRow[]>(`/audit-logs/user/${userId}${qs(params)}`),
  sensitive: (params: Record<string, string | number | undefined | null>) => apiClient.get<AuditRow[]>(`/audit-logs/sensitive${qs(params)}`),
  actionRegistry: () => apiClient.get<ActionDef[]>('/audit-logs/action-registry'),
  exportCsv: (params: Record<string, string | number | undefined | null>) => apiClient.get<{ csv: string; filename: string }>(`/audit-logs/export${qs(params)}`),
  controlledSubstanceReport: (params: Record<string, string | number | undefined | null>) => apiClient.get<{ csv: string; filename: string }>(`/audit-logs/controlled-substance-report${qs(params)}`),
  integrityStatus: () => apiClient.get<IntegrityStatus>('/audit-logs/integrity-status'),
  runIntegrityCheck: () => apiClient.post<{ chainIntact: boolean; recordsChecked: number; brokenAtRecordId: string | null }>('/audit-logs/integrity-check/run'),
};

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
