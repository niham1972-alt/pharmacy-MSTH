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
    <div className="print-grid space-y-6" data-testid="dashboard-page">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.title')}</h1>
        <DateRangeFilter />
      </div>

      <WidgetErrorBoundary title="KPI summary">
        <KpiCardGrid />
      </WidgetErrorBoundary>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <WidgetErrorBoundary title="Sales trend">
          <SalesTrendChart />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary title="Top selling medicines">
          <TopSellingTable />
        </WidgetErrorBoundary>
      </div>

      <WidgetErrorBoundary title="Alerts">
        <AlertsPanel />
      </WidgetErrorBoundary>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <WidgetErrorBoundary title="Activity feed">
          <ActivityFeed />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary title="Purchase snapshot">
          <PurchaseSnapshotCard />
        </WidgetErrorBoundary>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
