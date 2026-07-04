import { endOfDay, startOfDay, startOfMonth, subDays } from 'date-fns';
import { DateRangePreset } from '../../../shared/store/dashboardFilters';

export interface ResolvedRange {
  from: string;
  to: string;
}

/** Converts a filter preset into concrete ISO bounds sent to the API. `custom` uses the stored from/to as-is. */
export function resolvePreset(preset: DateRangePreset, customFrom?: string | null, customTo?: string | null): ResolvedRange | null {
  const now = new Date();

  switch (preset) {
    case 'today':
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
    case '7d':
      return { from: startOfDay(subDays(now, 6)).toISOString(), to: endOfDay(now).toISOString() };
    case '30d':
      return { from: startOfDay(subDays(now, 29)).toISOString(), to: endOfDay(now).toISOString() };
    case 'this_month':
      // `to` is capped at end of *today*, not end of month: the backend rejects a
      // future `to`, and there can't be sales in the future anyway.
      return { from: startOfMonth(now).toISOString(), to: endOfDay(now).toISOString() };
    case 'custom':
      return customFrom && customTo ? { from: customFrom, to: customTo } : null;
    default:
      return null;
  }
}
