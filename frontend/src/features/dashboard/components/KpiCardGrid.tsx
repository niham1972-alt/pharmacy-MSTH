import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDashboardSummary } from '../hooks/useDashboardSummary';
import { useDateRange } from '../hooks/useDateRange';
import { KpiCard } from './KpiCard';
import { formatCurrency } from '../utils/formatCurrency';
import { useDashboardFilters, DateRangePreset } from '../../../shared/store/dashboardFilters';

// TODO(Module 18 - Settings): read the pharmacy's configured currency instead of defaulting to PKR.
const CURRENCY = 'PKR';

// Maps a date-range preset to its `dashboard.filters.*` i18n key.
const PRESET_LABEL_KEY: Record<DateRangePreset, string> = {
  today: 'today',
  '7d': 'last7Days',
  '30d': 'last30Days',
  this_month: 'thisMonth',
  custom: 'custom',
};

export function KpiCardGrid() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const preset = useDashboardFilters((s) => s.preset);
  const { from, to } = useDateRange();
  const { data, isLoading, isError, refetch } = useDashboardSummary();

  // Sales/Profit cards are range-scoped: label them after the active range so
  // "Today's Sales" doesn't wrongly show while viewing e.g. "This Month".
  // "Custom" with no dates picked yet resolves to null bounds — the backend then
  // defaults to today, so label it "Today's" to match the data actually shown.
  const isTodayEffective = preset === 'today' || (preset === 'custom' && (!from || !to));
  const rangeLabel = t(`dashboard.filters.${PRESET_LABEL_KEY[preset]}`);
  const salesLabel = isTodayEffective ? t('dashboard.kpi.todaySales') : t('dashboard.kpi.salesInRange', { range: rangeLabel });
  const profitLabel = isTodayEffective ? t('dashboard.kpi.todayProfit') : t('dashboard.kpi.profitInRange', { range: rangeLabel });

  const cards: Array<{ key: string; label: string; value: number; format?: (n: number) => string; changePct?: number | 'new'; onClick?: () => void }> = [];

  if (data?.todaySales) {
    cards.push({
      key: 'todaySales',
      label: salesLabel,
      value: data.todaySales.amount,
      format: (n) => formatCurrency(n, CURRENCY),
      changePct: data.todaySales.changePct,
    });
  }
  if (data?.todayProfit) {
    cards.push({
      key: 'todayProfit',
      label: profitLabel,
      value: data.todayProfit.amount,
      format: (n) => formatCurrency(n, CURRENCY),
      changePct: data.todayProfit.changePct,
    });
  }
  if (data?.monthPurchases) {
    cards.push({ key: 'monthPurchases', label: t('dashboard.kpi.monthPurchases'), value: data.monthPurchases.amount, format: (n) => formatCurrency(n, CURRENCY) });
  }
  if (data?.monthExpenses) {
    cards.push({ key: 'monthExpenses', label: t('dashboard.kpi.monthExpenses'), value: data.monthExpenses.amount, format: (n) => formatCurrency(n, CURRENCY) });
  }
  if (data?.lowStockCount !== undefined) {
    cards.push({ key: 'lowStock', label: t('dashboard.kpi.lowStock'), value: data.lowStockCount, onClick: () => navigate('/inventory?filter=low_stock') });
  }
  if (data?.expiringSoonCount !== undefined) {
    cards.push({ key: 'expiringSoon', label: t('dashboard.kpi.expiringSoon'), value: data.expiringSoonCount, onClick: () => navigate('/batches?filter=expiring') });
  }
  if (data?.outOfStockCount !== undefined) {
    cards.push({ key: 'outOfStock', label: t('dashboard.kpi.outOfStock'), value: data.outOfStockCount, onClick: () => navigate('/inventory?filter=out_of_stock') });
  }
  if (data?.pendingPurchaseOrders !== undefined) {
    cards.push({ key: 'pendingPurchaseOrders', label: t('dashboard.kpi.pendingPurchaseOrders'), value: data.pendingPurchaseOrders, onClick: () => navigate('/purchases?status=pending') });
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" data-testid="kpi-grid-loading">
        {Array.from({ length: 8 }).map((_, i) => (
          <KpiCard key={i} label="" value={0} loading />
        ))}
      </div>
    );
  }

  if (isError) {
    return <KpiCard label="KPI summary" value={0} error onRetry={() => refetch()} />;
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" data-testid="kpi-grid">
      {cards.map((c) => (
        <KpiCard key={c.key} label={c.label} value={c.value} formatValue={c.format} changePct={c.changePct} onClick={c.onClick} />
      ))}
    </div>
  );
}
