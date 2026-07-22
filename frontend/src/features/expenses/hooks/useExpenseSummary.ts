import { useQuery } from '@tanstack/react-query';
import { expensesApi } from '../api/expenses.api';

export function useExpenseSummary(params: { dateFrom?: string; dateTo?: string; branchId?: string }) {
  return useQuery({
    queryKey: ['expense-summary', params],
    queryFn: async () => (await expensesApi.summary({ dateFrom: params.dateFrom || undefined, dateTo: params.dateTo || undefined, branchId: params.branchId || undefined })).data,
  });
}
