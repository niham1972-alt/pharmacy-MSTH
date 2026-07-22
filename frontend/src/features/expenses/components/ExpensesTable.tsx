import { Link } from 'react-router-dom';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { Expense } from '../types/expense.types';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { ApprovalStatusBadge } from './ApprovalStatusBadge';

export function ExpensesTable({ rows, isLoading }: { rows?: Expense[]; isLoading?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2">EXP #</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Payee</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2">Due</th>
            <th className="px-3 py-2">Payment</th>
            <th className="px-3 py-2">Approval</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {isLoading && <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">Loading…</td></tr>}
          {!isLoading && rows?.length === 0 && <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400">No expenses recorded yet.</td></tr>}
          {rows?.map((e) => (
            <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
              <td className="px-3 py-2">
                <Link to={`/expenses/${e.id}`} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">{e.expenseNumber}</Link>
                {e.isRecurringGenerated && <span className="ml-1 rounded bg-purple-100 px-1 text-[10px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" title="Auto-generated from a recurring template">↻</span>}
              </td>
              <td className="px-3 py-2 text-gray-500">{new Date(e.incurredDate).toLocaleDateString()}</td>
              <td className="px-3 py-2">{e.categoryName}</td>
              <td className="px-3 py-2">{e.payeeName}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(e.amount)}</td>
              <td className={`px-3 py-2 ${e.isOverdue ? 'font-medium text-red-600 dark:text-red-400' : 'text-gray-500'}`}>{e.dueDate ? new Date(e.dueDate).toLocaleDateString() : '—'}</td>
              <td className="px-3 py-2"><PaymentStatusBadge status={e.paymentStatus} isOverdue={e.isOverdue} /></td>
              <td className="px-3 py-2"><ApprovalStatusBadge status={e.approvalStatus} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
