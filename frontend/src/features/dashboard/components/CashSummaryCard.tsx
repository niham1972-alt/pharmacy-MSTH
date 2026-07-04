import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../shared/auth/AuthContext';
import { useCashSummary } from '../hooks/useCashSummary';
import { canAccessWidget } from '../utils/rolePermissions';
import { WidgetSkeleton } from './WidgetSkeleton';
import { WidgetErrorCard } from './WidgetErrorCard';
import { EmptyState } from './EmptyState';
import { formatCurrency } from '../utils/formatCurrency';

export function CashSummaryCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useCashSummary();

  if (!canAccessWidget(user?.role, 'cashSummary')) return null;

  const methods = data ? Object.entries(data.totalsByMethod) : [];

  return (
    <section aria-labelledby="cash-summary-heading" className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <h2 id="cash-summary-heading" className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {t('dashboard.cashSummary.title')} {data?.scope === 'own' && <span className="text-xs text-gray-500">(your shift)</span>}
      </h2>

      {isLoading && <WidgetSkeleton rows={3} />}
      {isError && <WidgetErrorCard title={t('dashboard.cashSummary.title')} onRetry={() => refetch()} />}
      {!isLoading && !isError && methods.length === 0 && <EmptyState message="No payments recorded for this period." />}
      {!isLoading && !isError && methods.length > 0 && (
        <ul className="space-y-1 text-sm">
          {methods.map(([method, amount]) => (
            <li key={method} className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{method}</span>
              <span className="font-medium">{formatCurrency(amount)}</span>
            </li>
          ))}
          <li className="mt-1 flex justify-between border-t border-gray-200 dark:border-gray-800 pt-1 font-semibold">
            <span>Total</span>
            <span>{formatCurrency(data?.total ?? 0)}</span>
          </li>
        </ul>
      )}
    </section>
  );
}
