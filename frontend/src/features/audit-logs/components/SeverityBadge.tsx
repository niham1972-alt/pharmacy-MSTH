import { AuditSeverity } from '../api/audit-logs.api';

const CLS: Record<AuditSeverity, string> = {
  ROUTINE: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  SENSITIVE: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
};
const LABEL: Record<AuditSeverity, string> = { ROUTINE: 'Routine', SENSITIVE: 'Sensitive', CRITICAL: 'Critical' };

export function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CLS[severity]}`}>{LABEL[severity]}</span>;
}
