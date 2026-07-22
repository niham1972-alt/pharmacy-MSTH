import { useQuery } from '@tanstack/react-query';
import { expensesApi } from '../api/expenses.api';

export function useExpenseDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['expense', id],
    queryFn: async () => (await expensesApi.detail(id as string)).data,
    enabled: !!id,
  });
}
