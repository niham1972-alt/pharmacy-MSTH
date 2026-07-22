import { RECURRENCE_LABELS, RecurrenceFrequency } from '../types/expense.types';

export interface RecurringConfig {
  enabled: boolean;
  recurrenceFrequency: RecurrenceFrequency;
  dayOfPeriod: number;
}

const inputCls = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm';

/**
 * "Make this recurring" toggle that reveals recurrence fields only when enabled
 * (spec §5 / §20). Purely presentational — the parent form owns the state.
 */
export function RecurringToggleSection({ value, onChange }: { value: RecurringConfig; onChange: (v: RecurringConfig) => void }) {
  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-800 p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
        <input type="checkbox" checked={value.enabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />
        Make this a recurring expense template
      </label>
      {value.enabled && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-gray-500">Frequency</span>
            <select
              value={value.recurrenceFrequency}
              onChange={(e) => onChange({ ...value, recurrenceFrequency: e.target.value as RecurrenceFrequency })}
              className={`${inputCls} w-full`}
            >
              {(Object.keys(RECURRENCE_LABELS) as RecurrenceFrequency[]).map((f) => (
                <option key={f} value={f}>{RECURRENCE_LABELS[f]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-gray-500">Day of period (1–31)</span>
            <input
              type="number"
              min={1}
              max={31}
              value={value.dayOfPeriod}
              onChange={(e) => onChange({ ...value, dayOfPeriod: Number(e.target.value) })}
              className={`${inputCls} w-full`}
            />
            <span className="mt-1 block text-[11px] text-gray-400">Days beyond a month&rsquo;s length fall on its last day.</span>
          </label>
        </div>
      )}
    </div>
  );
}
