import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { useExpenseSummary } from '../../features/expenses/hooks/useExpenseSummary';
import { ExpenseCategoryBreakdownChart } from '../../features/expenses/components/ExpenseCategoryBreakdownChart';

const inputCls = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm';
const firstOfMonth = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

export function ExpenseSummaryReportPage() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const { data, isLoading } = useExpenseSummary({ dateFrom, dateTo });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Expense Summary</h1>
          <Link to="/expenses" className="text-sm text-brand-600 hover:underline">← Back to expenses</Link>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} aria-label="From date" />
          <span className="text-gray-400">→</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} aria-label="To date" />
          <button onClick={() => window.print()} className="no-print rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Print / Export</button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
        <p className="text-xs uppercase text-gray-400">Total expenses in period</p>
        <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(data?.total ?? 0)}</p>
        <p className="text-xs text-gray-500">{data?.count ?? 0} expense(s) · feeds the Dashboard &ldquo;Total Expenses&rdquo; KPI</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
          <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">By category</h2>
          {isLoading ? <div className="py-8 text-center text-gray-400">Loading…</div> : <ExpenseCategoryBreakdownChart summary={data} />}
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Category</th><th className="px-3 py-2 text-right">Count</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {!isLoading && (data?.byCategory.length ?? 0) === 0 && <tr><td colSpan={3} className="px-3 py-10 text-center text-gray-400">No expenses in this period.</td></tr>}
              {data?.byCategory.map((c) => (
                <tr key={c.categoryId}><td className="px-3 py-2">{c.label}</td><td className="px-3 py-2 text-right text-gray-500">{c.count}</td><td className="px-3 py-2 text-right font-medium">{formatCurrency(c.total)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
