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
    <section aria-labelledby="alerts-heading" className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 id="alerts-heading" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t('dashboard.alerts.title')}
          </h2>
          {data && data.length > 0 && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">{data.length}</span>}
        </div>
        <div className="flex items-center gap-3">
          <div role="tablist" aria-label="Alert type" className="flex gap-1 text-[11px]">
            {TABS.map((tabItem) => (
              <button
                key={tabItem.label}
                role="tab"
                aria-selected={tab === tabItem.key}
                onClick={() => setTab(tabItem.key)}
                className={`rounded px-1.5 py-0.5 ${tab === tabItem.key ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
              >
                {tabItem.label}
              </button>
            ))}
          </div>
          <span
            className={`flex items-center gap-1 text-[11px] ${realtimeStatus === 'live' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}
          >
            <span aria-hidden="true">●</span>
            {realtimeStatus === 'live' ? t('dashboard.realtime.live') : t('dashboard.realtime.reconnecting')}
          </span>
        </div>
      </div>

      {isLoading && <WidgetSkeleton rows={4} />}
      {isError && <WidgetErrorCard title={t('dashboard.alerts.title')} onRetry={() => refetch()} />}
      {!isLoading && !isError && (!data || data.length === 0) && <EmptyState icon="✅" message={t('dashboard.alerts.empty')} />}
      {!isLoading && !isError && data && data.length > 0 && (
        // Fixed-height, self-scrolling panel: a variable/unbounded alert list can
        // never push the rest of the dashboard below the fold.
        <ul className="max-h-[168px] overflow-y-auto pr-1">
          {data.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </ul>
      )}
    </section>
  );
}
