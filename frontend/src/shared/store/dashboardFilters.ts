import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DateRangePreset = 'today' | '7d' | '30d' | 'this_month' | 'custom';

export interface DashboardFiltersState {
  branchId: string | null;
  preset: DateRangePreset;
  from: string | null;
  to: string | null;
  autoRefresh: boolean;
  setBranchId: (branchId: string) => void;
  setPreset: (preset: DateRangePreset) => void;
  setCustomRange: (from: string, to: string) => void;
  toggleAutoRefresh: () => void;
}

export const useDashboardFilters = create<DashboardFiltersState>()(
  persist(
    (set) => ({
      branchId: null,
      preset: 'today',
      from: null,
      to: null,
      autoRefresh: true,
      setBranchId: (branchId) => set({ branchId }),
      setPreset: (preset) => set({ preset, ...(preset !== 'custom' ? { from: null, to: null } : {}) }),
      setCustomRange: (from, to) => set({ preset: 'custom', from, to }),
      toggleAutoRefresh: () => set((s) => ({ autoRefresh: !s.autoRefresh })),
    }),
    { name: 'dashboard-filters' },
  ),
);
