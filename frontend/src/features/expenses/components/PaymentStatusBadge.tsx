import { ExpensePaymentStatus } from '../types/expense.types';

const MAP: Record<ExpensePaymentStatus, [string, string]> = {
  PAID: ['Paid', 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'],
  PARTIALLY_PAID: ['Partially paid', 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'],
  UNPAID: ['Unpaid', 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'],
};

/** `isOverdue` overrides the stored status for display (spec §2.3 computed OVERDUE). */
export function PaymentStatusBadge({ status, isOverdue }: { status: ExpensePaymentStatus; isOverdue?: boolean }) {
  if (isOverdue && status !== 'PAID') {
    return <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Overdue</span>;
  }
  const [label, cls] = MAP[status];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
