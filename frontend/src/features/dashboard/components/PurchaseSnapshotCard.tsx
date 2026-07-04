import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../shared/auth/AuthContext';
import { usePurchaseSnapshot } from '../hooks/usePurchaseSnapshot';
import { canAccessWidget } from '../utils/rolePermissions';
import { WidgetSkeleton } from './WidgetSkeleton';
import { WidgetErrorCard } from './WidgetErrorCard';
import { EmptyState } from './EmptyState';
import { formatCurrency } from '../utils/formatCurrency';

export function PurchaseSnapshotCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = usePurchaseSnapshot();

  if (!canAccessWidget(user?.role, 'purchaseSnapshot')) return null;

  return (
    <section aria-labelledby="purchase-snapshot-heading" className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <h2 id="purchase-snapshot-heading" className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {t('dashboard.purchaseSnapshot.title')}
      </h2>

      {isLoading && <WidgetSkeleton rows={3} />}
      {isError && <WidgetErrorCard title={t('dashboard.purchaseSnapshot.title')} onRetry={() => refetch()} />}
      {!isLoading && !isError && data && data.pendingOrders.length === 0 && (
        <EmptyState message={t('dashboard.purchaseSnapshot.empty')} />
      )}
      {!isLoading && !isError && data && data.pendingOrders.length > 0 && (
        <ul className="space-y-2 text-sm">
          {data.pendingOrders.map((order) => (
            <li key={order.id} className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
              <span>
                {order.status} · {new Date(order.createdAt).toLocaleDateString()}
              </span>
              <span className="font-medium">{formatCurrency(order.totalAmount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
