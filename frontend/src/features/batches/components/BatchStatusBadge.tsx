import { BatchRow, BatchStatus, ExpiryTier } from '../api/batches.api';

// Tiered expiry colour scheme, matching Module 1's Dashboard alert convention.
const TIER_CLS: Record<ExpiryTier, string> = {
  red: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  fresh: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
};

const STATUS_LABEL: Record<BatchStatus, string> = {
  FRESH: 'Fresh',
  EXPIRING_SOON: 'Expiring Soon',
  EXPIRED: 'Expired',
  DEPLETED: 'Depleted',
  RECALLED: 'Recalled',
};

export function BatchStatusBadge({ batch }: { batch: Pick<BatchRow, 'status' | 'tier' | 'isRecalled'> }) {
  let cls: string;
  if (batch.status === 'RECALLED' || batch.isRecalled) cls = 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300';
  else if (batch.status === 'EXPIRED') cls = TIER_CLS.red;
  else if (batch.status === 'DEPLETED') cls = 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  else cls = TIER_CLS[batch.tier];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{STATUS_LABEL[batch.status]}</span>;
}

/** Days-to-expiry chip, colour-coded by tier. */
export function ExpiryChip({ daysToExpiry, tier }: { daysToExpiry: number; tier: ExpiryTier }) {
  const label = daysToExpiry < 0 ? `${Math.abs(daysToExpiry)}d ago` : `${daysToExpiry}d`;
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${TIER_CLS[daysToExpiry < 0 ? 'red' : tier]}`}>{label}</span>;
}
