import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../shared/auth/AuthContext';
import { dashboardApi } from '../api/dashboard.api';
import { useDateRange } from './useDateRange';
import { useDashboardFilters } from '../../../shared/store/dashboardFilters';

export function useDashboardSummary() {
  const { user } = useAuth();
  const { branchId, from, to } = useDateRange();
  const autoRefresh = useDashboardFilters((s) => s.autoRefresh);

  return useQuery({
    queryKey: ['dashboard', 'summary', user?.pharmacyId, branchId, from, to],
    queryFn: async () => (await dashboardApi.getSummary({ branchId, from, to })).data,
    enabled: !!user,
    refetchInterval: autoRefresh ? 60_000 : false,
  });
}
