import { LicenseStatus } from '../api/suppliers.api';

const LICENSE_CLS: Record<LicenseStatus, string> = {
  valid: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  expiring: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  expired: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  none: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};
const LICENSE_LABEL: Record<LicenseStatus, string> = { valid: 'License valid', expiring: 'License expiring', expired: 'License expired', none: 'No license' };

export function LicenseBadge({ status, daysToExpiry }: { status: LicenseStatus; daysToExpiry?: number | null }) {
  const suffix = status === 'expiring' && daysToExpiry != null ? ` (${daysToExpiry}d)` : status === 'expired' && daysToExpiry != null ? ` (${Math.abs(daysToExpiry)}d ago)` : '';
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${LICENSE_CLS[status]}`}>{LICENSE_LABEL[status]}{suffix}</span>;
}

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${isActive ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{isActive ? 'Active' : 'Archived'}</span>;
}

const TYPE_LABEL: Record<string, string> = { MANUFACTURER: 'Manufacturer', DISTRIBUTOR: 'Distributor', WHOLESALER: 'Wholesaler', LOCAL_VENDOR: 'Local Vendor' };
export function TypeBadge({ type }: { type: string }) {
  return <span className="inline-block rounded-full bg-brand-50 dark:bg-brand-700/20 px-2 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-400">{TYPE_LABEL[type] ?? type}</span>;
}
