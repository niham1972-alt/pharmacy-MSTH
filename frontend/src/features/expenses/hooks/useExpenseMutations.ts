import { useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '../api/expenses.api';
import { CreateExpenseInput, RecordPaymentInput } from '../types/expense.types';

/** Every expense write invalidates the list + the affected detail + payables. */
function useInvalidate() {
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: ['expenses'] });
    void qc.invalidateQueries({ queryKey: ['expense-payables'] });
    void qc.invalidateQueries({ queryKey: ['expense-summary'] });
    if (id) void qc.invalidateQueries({ queryKey: ['expense', id] });
  };
}

export function useExpenseMutations() {
  const invalidate = useInvalidate();

  const create = useMutation({
    mutationFn: (body: CreateExpenseInput) => expensesApi.create(body),
    onSuccess: () => invalidate(),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CreateExpenseInput> }) => expensesApi.update(id, body),
    onSuccess: (_r, v) => invalidate(v.id),
  });
  const approve = useMutation({
    mutationFn: (id: string) => expensesApi.approve(id),
    onSuccess: (_r, id) => invalidate(id),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => expensesApi.reject(id, reason),
    onSuccess: (_r, v) => invalidate(v.id),
  });
  const recordPayment = useMutation({
    mutationFn: ({ id, body }: { id: string; body: RecordPaymentInput }) => expensesApi.recordPayment(id, body),
    onSuccess: (_r, v) => invalidate(v.id),
  });

  return { create, update, approve, reject, recordPayment };
}
