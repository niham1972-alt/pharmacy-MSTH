import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../shared/auth/AuthContext';
import { useDashboardFilters } from '../../../shared/store/dashboardFilters';
import { dashboardApi } from '../api/dashboard.api';
import { canAccessWidget } from '../utils/rolePermissions';

export function usePurchaseSnapshot() {
  const { user } = useAuth();
  const branchId = useDashboardFilters((s) => s.branchId);
  const allowed = canAccessWidget(user?.role, 'purchaseSnapshot');

  return useQuery({
    queryKey: ['dashboard', 'purchase-snapshot', user?.pharmacyId, branchId],
    queryFn: async () => (await dashboardApi.getPurchaseSnapshot({ branchId })).data,
    enabled: !!user && allowed,
  });
}
