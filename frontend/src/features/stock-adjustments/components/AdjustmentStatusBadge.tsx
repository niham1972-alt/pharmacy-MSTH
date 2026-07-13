import { AdjustmentStatus } from '../types/stock-adjustment.types';

const MAP: Record<AdjustmentStatus, [string, string]> = {
  AUTO_APPROVED: ['Auto-approved', 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'],
  APPROVED: ['Approved', 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'],
  PENDING_APPROVAL: ['Pending', 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'],
  REJECTED: ['Rejected', 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'],
};

export function AdjustmentStatusBadge({ status }: { status: AdjustmentStatus }) {
  const [label, cls] = MAP[status];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
