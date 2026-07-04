import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../shared/auth/AuthContext';
import { dashboardApi } from '../api/dashboard.api';
import { useDateRange } from './useDateRange';
import { canAccessWidget } from '../utils/rolePermissions';

export function useSalesTrend(granularity: 'day' | 'week' | 'month' = 'day') {
  const { user } = useAuth();
  const { branchId, from, to } = useDateRange();
  const allowed = canAccessWidget(user?.role, 'salesTrend');

  return useQuery({
    queryKey: ['dashboard', 'sales-trend', user?.pharmacyId, branchId, from, to, granularity],
    queryFn: async () => (await dashboardApi.getSalesTrend({ branchId, from, to, granularity })).data,
    enabled: !!user && allowed,
  });
}
