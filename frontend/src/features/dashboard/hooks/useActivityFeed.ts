import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../../../shared/auth/AuthContext';
import { useDashboardFilters } from '../../../shared/store/dashboardFilters';
import { dashboardApi } from '../api/dashboard.api';
import { ActivityFeedItem } from '../types/dashboard.types';

const PAGE_SIZE = 15;

export function useActivityFeed() {
  const { user } = useAuth();
  const branchId = useDashboardFilters((s) => s.branchId);

  return useInfiniteQuery({
    queryKey: ['dashboard', 'activity-feed', user?.pharmacyId, branchId],
    queryFn: async ({ pageParam }: { pageParam?: string }) =>
      (await dashboardApi.getActivityFeed({ branchId, limit: PAGE_SIZE, cursor: pageParam })).data,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: ActivityFeedItem[]) =>
      lastPage.length === PAGE_SIZE ? lastPage[lastPage.length - 1]?.id : undefined,
    enabled: !!user,
  });
}
