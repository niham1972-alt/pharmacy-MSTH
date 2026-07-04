import { useTranslation } from 'react-i18next';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSalesTrend } from '../hooks/useSalesTrend';
import { canAccessWidget } from '../utils/rolePermissions';
import { useAuth } from '../../../shared/auth/AuthContext';
import { WidgetSkeleton } from './WidgetSkeleton';
import { WidgetErrorCard } from './WidgetErrorCard';
import { EmptyState } from './EmptyState';
import { formatCurrency } from '../utils/formatCurrency';

export function SalesTrendChart() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useSalesTrend();
  const showProfit = canAccessWidget(user?.role, 'salesTrendProfit');

  if (!canAccessWidget(user?.role, 'salesTrend')) return null;

  return (
    <section aria-labelledby="sales-trend-heading" className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <h2 id="sales-trend-heading" className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {t('dashboard.salesTrend.title')}
      </h2>

      {isLoading && <WidgetSkeleton rows={5} />}
      {isError && <WidgetErrorCard title={t('dashboard.salesTrend.title')} onRetry={() => refetch()} />}
      {!isLoading && !isError && (!data || data.length === 0) && (
        <EmptyState message={t('dashboard.empty.noSalesToday')} />
      )}
      {!isLoading && !isError && data && data.length > 0 && (
        <div style={{ width: '100%', height: 260 }} role="img" aria-label={t('dashboard.salesTrend.title')}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <XAxis dataKey="date" tickFormatter={(d: string) => new Date(d).toLocaleDateString()} fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v: number) => formatCurrency(v)} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(d: string) => new Date(d).toLocaleDateString()} />
              <Line type="monotone" dataKey="revenue" name={t('dashboard.salesTrend.revenue')} stroke="#2563eb" strokeWidth={2} dot={false} />
              {showProfit && (
                <Line type="monotone" dataKey="profit" name={t('dashboard.salesTrend.profit')} stroke="#009e73" strokeWidth={2} dot={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
