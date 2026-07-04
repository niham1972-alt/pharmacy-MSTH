import { StockStatus } from '../types/medicine.types';

const CONFIG: Record<StockStatus, { label: string; icon: string; cls: string }> = {
  in_stock: { label: 'In Stock', icon: '✓', cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  low: { label: 'Low Stock', icon: '⚠', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  out: { label: 'Out of Stock', icon: '✕', cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
};

// Colour is paired with an icon + text so it never relies on colour alone (WCAG).
export function StockStatusBadge({ status, count }: { status: StockStatus; count?: number }) {
  const c = CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.cls}`}>
      <span aria-hidden>{c.icon}</span>
      {c.label}
      {count !== undefined && <span className="opacity-70">· {count}</span>}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    INACTIVE: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    DISCONTINUED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? ''}`}>{status}</span>;
}
