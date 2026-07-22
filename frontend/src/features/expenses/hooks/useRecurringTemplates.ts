import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '../api/expenses.api';
import { CreateTemplateInput } from '../types/expense.types';

export function useRecurringTemplates() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['expense-templates'] });
    void qc.invalidateQueries({ queryKey: ['expenses'] });
  };

  const query = useQuery({
    queryKey: ['expense-templates'],
    queryFn: async () => (await expensesApi.templates()).data,
  });

  const create = useMutation({ mutationFn: (body: CreateTemplateInput) => expensesApi.createTemplate(body), onSuccess: invalidate });
  const pause = useMutation({ mutationFn: (id: string) => expensesApi.pauseTemplate(id), onSuccess: invalidate });
  const resume = useMutation({ mutationFn: (id: string) => expensesApi.resumeTemplate(id), onSuccess: invalidate });
  const end = useMutation({ mutationFn: (id: string) => expensesApi.endTemplate(id), onSuccess: invalidate });
  const runGeneration = useMutation({ mutationFn: () => expensesApi.runGeneration(), onSuccess: invalidate });

  return { query, create, pause, resume, end, runGeneration };
}
