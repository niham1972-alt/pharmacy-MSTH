import { ExpenseApprovalStatus } from '../types/expense.types';

const MAP: Record<ExpenseApprovalStatus, [string, string]> = {
  NOT_REQUIRED: ['—', 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'],
  PENDING_APPROVAL: ['Pending approval', 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'],
  APPROVED: ['Approved', 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'],
  REJECTED: ['Rejected', 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'],
};

export function ApprovalStatusBadge({ status }: { status: ExpenseApprovalStatus }) {
  const [label, cls] = MAP[status];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`} title={status === 'NOT_REQUIRED' ? 'No approval required' : undefined}>{label}</span>;
}
