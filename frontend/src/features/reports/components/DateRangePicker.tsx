import { DateRangeType, ReportFilters } from '../types/reports.types';

const inputCls = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm';

const PRESETS: Array<{ value: DateRangeType; label: string }> = [
  { value: 'custom', label: 'Custom range' },
  { value: 'rolling_last_7_days', label: 'Last 7 days' },
  { value: 'rolling_this_month', label: 'This month' },
  { value: 'rolling_last_month', label: 'Last month' },
  { value: 'rolling_this_year', label: 'This year' },
];

/**
 * Shared date-range picker reused by EVERY report page (spec §9). Presets recompute
 * server-side (rolling windows); "custom" reveals explicit from/to inputs.
 */
export function DateRangePicker({ value, onChange }: { value: ReportFilters; onChange: (patch: Partial<ReportFilters>) => void }) {
  const rangeType = value.dateRangeType ?? 'custom';
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-sm">
        <span className="mb-1 block text-xs text-gray-500">Period</span>
        <select value={rangeType} onChange={(e) => onChange({ dateRangeType: e.target.value as DateRangeType })} className={inputCls}>
          {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </label>
      {rangeType === 'custom' && (
        <>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-gray-500">From</span>
            <input type="date" value={value.dateFrom ?? ''} onChange={(e) => onChange({ dateFrom: e.target.value })} className={inputCls} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-gray-500">To</span>
            <input type="date" value={value.dateTo ?? ''} onChange={(e) => onChange({ dateTo: e.target.value })} className={inputCls} />
          </label>
        </>
      )}
    </div>
  );
}
