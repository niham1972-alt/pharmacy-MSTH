import { apiClient } from '../../../shared/api/client';
import {
  ConsolidatedPayableRow, CreateExpenseInput, CreateTemplateInput, Expense, ExpenseCategory,
  ExpenseDetail, ExpenseSummary, GenerationResult, PayablesTotals, RecordPaymentInput, RecurringTemplate,
} from '../types/expense.types';

function qs(p: Record<string, string | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : '';
}

export const expensesApi = {
  // Expenses
  list: (params: Record<string, string | undefined>) => apiClient.get<Expense[]>(`/expenses${qs(params)}`),
  detail: (id: string) => apiClient.get<ExpenseDetail>(`/expenses/${id}`),
  create: (body: CreateExpenseInput) => apiClient.post<Expense>('/expenses', body),
  update: (id: string, body: Partial<CreateExpenseInput>) => apiClient.put<Expense>(`/expenses/${id}`, body),
  approve: (id: string) => apiClient.post<Expense>(`/expenses/${id}/approve`),
  reject: (id: string, rejectedReason: string) => apiClient.post<Expense>(`/expenses/${id}/reject`, { rejectedReason }),
  recordPayment: (id: string, body: RecordPaymentInput) => apiClient.post<{ amountPaid: number; paymentStatus: string; outstanding: number }>(`/expenses/${id}/payments`, body),
  summary: (params: Record<string, string | undefined>) => apiClient.get<ExpenseSummary>(`/expenses/summary${qs(params)}`),
  consolidated: (params: Record<string, string | undefined>) =>
    apiClient.get<ConsolidatedPayableRow[]>(`/expenses/payables/consolidated${qs(params)}`) as Promise<{ data: ConsolidatedPayableRow[]; meta?: { totals: PayablesTotals } }>,

  // Categories
  categories: () => apiClient.get<ExpenseCategory[]>('/expense-categories'),
  createCategory: (body: { name: string; parentId?: string }) => apiClient.post<ExpenseCategory>('/expense-categories', body),
  updateCategory: (id: string, body: { name?: string; isActive?: boolean }) => apiClient.put<ExpenseCategory>(`/expense-categories/${id}`, body),
  removeCategory: (id: string) => apiClient.delete<{ deactivated: boolean; message: string }>(`/expense-categories/${id}`),

  // Recurring templates
  templates: () => apiClient.get<RecurringTemplate[]>('/recurring-expense-templates'),
  createTemplate: (body: CreateTemplateInput) => apiClient.post<RecurringTemplate>('/recurring-expense-templates', body),
  updateTemplate: (id: string, body: Partial<CreateTemplateInput>) => apiClient.put<RecurringTemplate>(`/recurring-expense-templates/${id}`, body),
  pauseTemplate: (id: string) => apiClient.post<RecurringTemplate>(`/recurring-expense-templates/${id}/pause`),
  resumeTemplate: (id: string) => apiClient.post<RecurringTemplate>(`/recurring-expense-templates/${id}/resume`),
  endTemplate: (id: string) => apiClient.post<RecurringTemplate>(`/recurring-expense-templates/${id}/end`),
  runGeneration: () => apiClient.post<GenerationResult>('/recurring-expense-templates/run-generation'),
};
