import { useQuery } from '@tanstack/react-query';
import { expensesApi } from '../api/expenses.api';
import { PayablesTotals } from '../types/expense.types';

export function useConsolidatedPayables(branchId?: string) {
  return useQuery({
    queryKey: ['expense-payables', branchId ?? 'all'],
    queryFn: async () => {
      const res = await expensesApi.consolidated({ branchId: branchId || undefined });
      const totals: PayablesTotals = res.meta?.totals ?? { count: 0, totalOutstanding: 0, overdueOutstanding: 0, expenseOutstanding: 0, purchaseOrderOutstanding: 0 };
      return { rows: res.data, totals };
    },
  });
}
