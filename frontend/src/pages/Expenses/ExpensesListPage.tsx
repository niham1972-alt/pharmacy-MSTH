import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { useExpensesList, useExpenseCategories, ExpenseFilters } from '../../features/expenses/hooks/useExpensesList';
import { ExpensesTable } from '../../features/expenses/components/ExpensesTable';
import { ExpenseForm } from '../../features/expenses/components/ExpenseForm';

const CAN_WRITE = ['super_admin', 'admin', 'accountant'];
const inputCls = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm';

export function ExpensesListPage() {
  const { user } = useAuth();
  const canWrite = CAN_WRITE.includes(user?.role ?? '');
  const [filters, setFilters] = useState<ExpenseFilters>({});
  const [adding, setAdding] = useState(false);
  const { data: categories } = useExpenseCategories();
  const { data, isLoading } = useExpensesList(filters);

  const set = (patch: Partial<ExpenseFilters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Expenses</h1>
        <div className="flex gap-2">
          <Link to="/expenses/payables" className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Payables</Link>
          <Link to="/expenses/templates" className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Recurring</Link>
          <Link to="/expenses/summary" className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Summary</Link>
          {canWrite && (
            <button onClick={() => setAdding((v) => !v)} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              {adding ? 'Close' : '+ New Expense'}
            </button>
          )}
        </div>
      </div>

      {adding && canWrite && (
        <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Record an expense</h2>
          <ExpenseForm onDone={() => setAdding(false)} onCancel={() => setAdding(false)} />
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <input value={filters.search ?? ''} onChange={(e) => set({ search: e.target.value })} placeholder="Search payee / notes / EXP#…" className={`${inputCls} w-56`} />
        <select value={filters.categoryId ?? ''} onChange={(e) => set({ categoryId: e.target.value })} className={inputCls}>
          <option value="">All categories</option>
          {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={filters.paymentStatus ?? ''} onChange={(e) => set({ paymentStatus: e.target.value })} className={inputCls}>
          <option value="">All payment statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIALLY_PAID">Partially paid</option>
          <option value="PAID">Paid</option>
        </select>
        <select value={filters.approvalStatus ?? ''} onChange={(e) => set({ approvalStatus: e.target.value })} className={inputCls}>
          <option value="">All approvals</option>
          <option value="PENDING_APPROVAL">Pending approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="NOT_REQUIRED">Not required</option>
        </select>
        <select value={filters.isRecurringGenerated ?? ''} onChange={(e) => set({ isRecurringGenerated: e.target.value })} className={inputCls}>
          <option value="">One-off & recurring</option>
          <option value="true">Recurring only</option>
          <option value="false">One-off only</option>
        </select>
        <input type="date" value={filters.dateFrom ?? ''} onChange={(e) => set({ dateFrom: e.target.value })} className={inputCls} aria-label="From date" />
        <input type="date" value={filters.dateTo ?? ''} onChange={(e) => set({ dateTo: e.target.value })} className={inputCls} aria-label="To date" />
      </div>

      <ExpensesTable rows={data} isLoading={isLoading} />
    </div>
  );
}
