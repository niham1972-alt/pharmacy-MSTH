const MAP: Record<string, string> = {
  TRIAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  PAST_DUE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  SUSPENDED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  ARCHIVED: 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  CANCELLED: 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export function TenantStatusBadge({ status }: { status: string }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${MAP[status] ?? 'bg-gray-100 text-gray-600'}`}>{status.replace('_', ' ')}</span>;
}
