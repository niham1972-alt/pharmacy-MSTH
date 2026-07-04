import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../shared/auth/AuthContext';
import { dashboardApi } from '../api/dashboard.api';
import { useDateRange } from './useDateRange';
import { canAccessWidget } from '../utils/rolePermissions';

export function useCashSummary() {
  const { user } = useAuth();
  const { branchId, from, to } = useDateRange();
  const allowed = canAccessWidget(user?.role, 'cashSummary');

  return useQuery({
    queryKey: ['dashboard', 'cash-summary', user?.pharmacyId, branchId, from, to],
    queryFn: async () => (await dashboardApi.getCashSummary({ branchId, from, to })).data,
    enabled: !!user && allowed,
  });
}
