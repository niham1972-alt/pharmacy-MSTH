import { useQuery } from '@tanstack/react-query';
import { expensesApi } from '../api/expenses.api';

export interface ExpenseFilters {
  search?: string;
  categoryId?: string;
  paymentStatus?: string;
  approvalStatus?: string;
  isRecurringGenerated?: string;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}

export function useExpensesList(filters: ExpenseFilters) {
  return useQuery({
    queryKey: ['expenses', filters],
    queryFn: async () => {
      const clean: Record<string, string | undefined> = { limit: '100' };
      for (const [k, v] of Object.entries(filters)) clean[k] = v || undefined;
      const res = await expensesApi.list(clean);
      return res.data;
    },
  });
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => (await expensesApi.categories()).data,
    staleTime: 60_000,
  });
}
