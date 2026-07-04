import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardFilters, DateRangePreset } from '../../../shared/store/dashboardFilters';

const PRESETS: Array<{ value: DateRangePreset; labelKey: string }> = [
  { value: 'today', labelKey: 'dashboard.filters.today' },
  { value: '7d', labelKey: 'dashboard.filters.last7Days' },
  { value: '30d', labelKey: 'dashboard.filters.last30Days' },
  { value: 'this_month', labelKey: 'dashboard.filters.thisMonth' },
  { value: 'custom', labelKey: 'dashboard.filters.custom' },
];

const MAX_RANGE_DAYS = 365;

export function DateRangeFilter() {
  const { t } = useTranslation();
  const { preset, setPreset, setCustomRange, autoRefresh, toggleAutoRefresh } = useDashboardFilters();
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Debounce custom-range commits by 300ms (spec §18) to avoid request storms while typing.
  useEffect(() => {
    if (preset !== 'custom' || !customFrom || !customTo) return;

    const handle = setTimeout(() => {
      const fromDate = new Date(customFrom);
      const toDate = new Date(customTo);

      if (fromDate > toDate) {
        setValidationError('Start date must be before end date');
        return;
      }
      const spanDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
      if (spanDays > MAX_RANGE_DAYS) {
        setValidationError(`Range cannot exceed ${MAX_RANGE_DAYS} days`);
        return;
      }

      setValidationError(null);
      setCustomRange(fromDate.toISOString(), toDate.toISOString());
    }, 300);

    return () => clearTimeout(handle);
  }, [customFrom, customTo, preset, setCustomRange]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="tablist" aria-label="Date range" className="flex gap-1 rounded-md border border-gray-300 dark:border-gray-700 p-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            role="tab"
            aria-selected={preset === p.value}
            onClick={() => setPreset(p.value)}
            className={`rounded px-2 py-1 text-xs ${
              preset === p.value ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            {t(p.labelKey)}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-2 text-xs">
          <input type="date" aria-label="From date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1" />
          <span>to</span>
          <input type="date" aria-label="To date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1" />
          {validationError && <span role="alert" className="text-red-600 dark:text-red-400">{validationError}</span>}
        </div>
      )}

      <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
        <input type="checkbox" checked={autoRefresh} onChange={toggleAutoRefresh} />
        Auto-refresh
      </label>
    </div>
  );
}
