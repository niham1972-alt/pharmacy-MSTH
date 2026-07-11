import { SETTLEMENT_LABELS, type SettlementStatus } from '../types/purchase-return.types';

const TONE: Record<SettlementStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  CREDITED: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400',
  PARTIALLY_CREDITED: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  REJECTED: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
};

export function SettlementStatusBadge({ status }: { status: SettlementStatus }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[status]}`}>{SETTLEMENT_LABELS[status]}</span>;
}
