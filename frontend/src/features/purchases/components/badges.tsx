import { PaymentStatus, POStatus } from '../types/purchase.types';

const PO_STATUS: Record<POStatus, string> = {
  DRAFT: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  APPROVED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  PARTIALLY_RECEIVED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  RECEIVED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  CLOSED: 'bg-gray-300 text-gray-800 dark:bg-gray-600 dark:text-gray-200',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const PAY_STATUS: Record<PaymentStatus, string> = {
  UNPAID: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  PARTIALLY_PAID: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  PAID: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

export function POStatusBadge({ status }: { status: POStatus }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PO_STATUS[status]}`}>{status.replace(/_/g, ' ')}</span>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PAY_STATUS[status]}`}>{status.replace(/_/g, ' ')}</span>;
}
