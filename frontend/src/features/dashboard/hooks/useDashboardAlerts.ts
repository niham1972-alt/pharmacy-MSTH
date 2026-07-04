import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../shared/auth/AuthContext';
import { useDashboardFilters } from '../../../shared/store/dashboardFilters';
import { dashboardApi } from '../api/dashboard.api';
import { canAccessWidget } from '../utils/rolePermissions';
import { DashboardAlert } from '../types/dashboard.types';

export function useDashboardAlerts(type?: string) {
  const { user } = useAuth();
  const branchId = useDashboardFilters((s) => s.branchId);
  const allowed = canAccessWidget(user?.role, 'alerts');

  return useQuery({
    queryKey: ['dashboard', 'alerts', user?.pharmacyId, branchId, type],
    queryFn: async () => (await dashboardApi.getAlerts({ branchId, type })).data,
    enabled: !!user && allowed,
    staleTime: 15_000,
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  const branchId = useDashboardFilters((s) => s.branchId);

  return useMutation({
    mutationFn: ({ alert, note }: { alert: DashboardAlert; note?: string }) =>
      dashboardApi.acknowledgeAlert(alert.referenceId, {
        branchId: branchId ?? '',
        alertType: alert.type,
        note,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'alerts'] });
    },
  });
}
