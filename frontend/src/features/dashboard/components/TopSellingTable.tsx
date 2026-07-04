import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../shared/auth/AuthContext';
import { useTopSelling } from '../hooks/useTopSelling';
import { canAccessWidget } from '../utils/rolePermissions';
import { WidgetSkeleton } from './WidgetSkeleton';
import { WidgetErrorCard } from './WidgetErrorCard';
import { EmptyState } from './EmptyState';
import { formatCurrency } from '../utils/formatCurrency';
import { TopSellingItem } from '../types/dashboard.types';

type SortKey = keyof Pick<TopSellingItem, 'name' | 'quantitySold' | 'revenue'>;

export function TopSellingTable() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [metric, setMetric] = useState<'qty' | 'revenue'>('revenue');
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDesc, setSortDesc] = useState(true);
  const { data, isLoading, isError, refetch } = useTopSelling(metric);

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      const diff = typeof a[sortKey] === 'string' ? String(a[sortKey]).localeCompare(String(b[sortKey])) : Number(a[sortKey]) - Number(b[sortKey]);
      return sortDesc ? -diff : diff;
    });
  }, [data, sortKey, sortDesc]);

  if (!canAccessWidget(user?.role, 'topSelling')) return null;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  return (
    <section aria-labelledby="top-selling-heading" className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="top-selling-heading" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('dashboard.topSelling.title')}
        </h2>
        <div className="flex gap-1 text-xs">
          <button
            className={`rounded px-2 py-1 ${metric === 'qty' ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-400'}`}
            onClick={() => setMetric('qty')}
          >
            {t('dashboard.topSelling.byQuantity')}
          </button>
          <button
            className={`rounded px-2 py-1 ${metric === 'revenue' ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-400'}`}
            onClick={() => setMetric('revenue')}
          >
            {t('dashboard.topSelling.byRevenue')}
          </button>
        </div>
      </div>

      {isLoading && <WidgetSkeleton rows={5} />}
      {isError && <WidgetErrorCard title={t('dashboard.topSelling.title')} onRetry={() => refetch()} />}
      {!isLoading && !isError && sorted.length === 0 && <EmptyState message={t('dashboard.topSelling.empty')} />}
      {!isLoading && !isError && sorted.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
              <th scope="col">
                <button onClick={() => toggleSort('name')}>Medicine</button>
              </th>
              <th scope="col">
                <button onClick={() => toggleSort('quantitySold')}>Qty Sold</button>
              </th>
              <th scope="col">
                <button onClick={() => toggleSort('revenue')}>Revenue</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={item.medicineId} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-1.5">{item.name}</td>
                <td className="py-1.5">{item.quantitySold}</td>
                <td className="py-1.5">{formatCurrency(item.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
