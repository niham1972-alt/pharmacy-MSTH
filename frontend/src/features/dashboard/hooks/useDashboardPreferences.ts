import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../shared/auth/AuthContext';
import { useDashboardFilters } from '../../../shared/store/dashboardFilters';
import { dashboardApi } from '../api/dashboard.api';
import { WidgetPreference } from '../types/dashboard.types';

export function useDashboardPreferences() {
  const { user } = useAuth();
  const branchId = useDashboardFilters((s) => s.branchId);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['dashboard', 'preferences', user?.pharmacyId, branchId],
    queryFn: async () => (await dashboardApi.getPreferences(branchId)).data,
    enabled: !!user,
  });

  const save = useMutation({
    mutationFn: (widgets: WidgetPreference[]) => dashboardApi.savePreferences(widgets, branchId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'preferences'] });
    },
  });

  return { ...query, savePreferences: save.mutate };
}
