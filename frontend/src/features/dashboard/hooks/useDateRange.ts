import { useMemo } from 'react';
import { useDashboardFilters } from '../../../shared/store/dashboardFilters';
import { resolvePreset } from '../utils/dateRangePresets';

/** Shared by every time-scoped widget hook so they all react to the same global filter. */
export function useDateRange() {
  const { preset, from, to, branchId } = useDashboardFilters();

  const range = useMemo(() => resolvePreset(preset, from, to), [preset, from, to]);

  return { branchId, from: range?.from ?? null, to: range?.to ?? null, preset };
}
