import { useTranslation } from 'react-i18next';
import { WidgetErrorBoundary } from '../../features/dashboard/components/WidgetErrorBoundary';
import { KpiCardGrid } from '../../features/dashboard/components/KpiCardGrid';
import { SalesTrendChart } from '../../features/dashboard/components/SalesTrendChart';
import { TopSellingTable } from '../../features/dashboard/components/TopSellingTable';
import { AlertsPanel } from '../../features/dashboard/components/AlertsPanel';
import { ActivityFeed } from '../../features/dashboard/components/ActivityFeed';
import { PurchaseSnapshotCard } from '../../features/dashboard/components/PurchaseSnapshotCard';
import { CashSummaryCard } from '../../features/dashboard/components/CashSummaryCard';
import { QuickActionsPanel } from '../../features/dashboard/components/QuickActionsPanel';
import { DateRangeFilter } from '../../features/dashboard/components/DateRangeFilter';

export function DashboardPage() {
  const { t } = useTranslation();

  return (
    <div className="print-grid space-y-3" data-testid="dashboard-page">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.title')}</h1>
        {/* Controls are secondary chrome — kept small/light next to the data. */}
        <div className="scale-95 opacity-90">
          <DateRangeFilter />
        </div>
      </div>

      {/* Zone A — KPI row */}
      <WidgetErrorBoundary title="KPI summary">
        <KpiCardGrid />
      </WidgetErrorBoundary>

      {/* Zone B — trend (wider) + top selling, side by side */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WidgetErrorBoundary title="Sales trend">
            <SalesTrendChart />
          </WidgetErrorBoundary>
        </div>
        <WidgetErrorBoundary title="Top selling medicines">
          <TopSellingTable />
        </WidgetErrorBoundary>
      </div>

      {/* Zone C — compact, self-scrolling alerts list */}
      <WidgetErrorBoundary title="Alerts">
        <AlertsPanel />
      </WidgetErrorBoundary>

      {/* Secondary widgets (below the primary fold; scroll acceptable here) */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <WidgetErrorBoundary title="Activity feed">
          <ActivityFeed />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary title="Purchase snapshot">
          <PurchaseSnapshotCard />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary title="Cash summary">
          <CashSummaryCard />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary title="Quick actions">
          <QuickActionsPanel />
        </WidgetErrorBoundary>
      </div>
    </div>
  );
}
