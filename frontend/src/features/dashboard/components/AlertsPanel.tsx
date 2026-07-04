import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../shared/auth/AuthContext';
import { useDashboardFilters } from '../../../shared/store/dashboardFilters';
import { useDashboardAlerts } from '../hooks/useDashboardAlerts';
import { useDashboardRealtime } from '../hooks/useDashboardRealtime';
import { canAccessWidget } from '../utils/rolePermissions';
import { AlertRow } from './AlertRow';
import { WidgetSkeleton } from './WidgetSkeleton';
import { WidgetErrorCard } from './WidgetErrorCard';
import { EmptyState } from './EmptyState';

const TABS = [
  { key: undefined, label: 'All' },
  { key: 'low_stock', label: 'Low Stock' },
  { key: 'expiry', label: 'Expiring' },
  { key: 'out_of_stock', label: 'Out of Stock' },
] as const;

export function AlertsPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const branchId = useDashboardFilters((s) => s.branchId);
  const [tab, setTab] = useState<string | undefined>(undefined);
  const { data, isLoading, isError, refetch } = useDashboardAlerts(tab);
  const realtimeStatus = useDashboardRealtime(branchId);

  if (!canAccessWidget(user?.role, 'alerts')) return null;

  return (
    <section aria-labelledby="alerts-heading" className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="alerts-heading" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('dashboard.alerts.title')}
        </h2>
        <span
          className={`flex items-center gap-1 text-xs ${realtimeStatus === 'live' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}
        >
          <span aria-hidden="true">●</span>
          {realtimeStatus === 'live' ? t('dashboard.realtime.live') : t('dashboard.realtime.reconnecting')}
        </span>
      </div>

      <div role="tablist" aria-label="Alert type" className="mb-3 flex gap-1 text-xs">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.label}
            role="tab"
            aria-selected={tab === tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`rounded px-2 py-1 ${tab === tabItem.key ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-400'}`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {isLoading && <WidgetSkeleton rows={4} />}
      {isError && <WidgetErrorCard title={t('dashboard.alerts.title')} onRetry={() => refetch()} />}
      {!isLoading && !isError && (!data || data.length === 0) && <EmptyState icon="✅" message={t('dashboard.alerts.empty')} />}
      {!isLoading && !isError && data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </ul>
      )}
    </section>
  );
}
