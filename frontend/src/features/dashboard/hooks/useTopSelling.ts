import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../shared/auth/AuthContext';
import { dashboardApi } from '../api/dashboard.api';
import { useDateRange } from './useDateRange';
import { canAccessWidget } from '../utils/rolePermissions';

export function useTopSelling(metric: 'qty' | 'revenue' = 'revenue', limit = 10) {
  const { user } = useAuth();
  const { branchId, from, to } = useDateRange();
  const allowed = canAccessWidget(user?.role, 'topSelling');

  return useQuery({
    queryKey: ['dashboard', 'top-selling', user?.pharmacyId, branchId, from, to, metric, limit],
    queryFn: async () => (await dashboardApi.getTopSelling({ branchId, from, to, metric, limit })).data,
    enabled: !!user && allowed,
  });
}
