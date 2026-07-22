import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '../api/reports.api';
import { ReportFilters, ReportType } from '../types/reports.types';

export function useSavedReportConfigurations() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['saved-reports'] });

  const query = useQuery({
    queryKey: ['saved-reports'],
    queryFn: async () => (await reportsApi.savedList()).data,
  });
  const create = useMutation({
    mutationFn: (body: { reportType: ReportType; name: string; filters: ReportFilters }) => reportsApi.savedCreate(body),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => reportsApi.savedDelete(id), onSuccess: invalidate });

  return { query, create, remove };
}
