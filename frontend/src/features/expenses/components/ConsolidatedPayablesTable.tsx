import { Link } from 'react-router-dom';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { ConsolidatedPayableRow } from '../types/expense.types';

/** Source tag distinguishing this module's expenses from Module 3's PO payables
 *  (spec §5 / §9) while they share one unified, sortable list. */
function SourceTag({ source }: { source: ConsolidatedPayableRow['source'] }) {
  return source === 'EXPENSE' ? (
    <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">Expense</span>
  ) : (
    <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">Purchase Order</span>
  );
}

export function ConsolidatedPayablesTable({ rows, isLoading }: { rows?: ConsolidatedPayableRow[]; isLoading?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2">Source</th>
            <th className="px-3 py-2">Reference</th>
            <th className="px-3 py-2">Party</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2 text-right">Outstanding</th>
            <th className="px-3 py-2">Due date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {isLoading && <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Loading…</td></tr>}
          {!isLoading && rows?.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-400">No outstanding payables — you&rsquo;re all caught up.</td></tr>}
          {rows?.map((r) => {
            const to = r.source === 'EXPENSE' ? `/expenses/${r.id}` : `/purchases/${r.id}`;
            return (
              <tr key={`${r.source}-${r.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                <td className="px-3 py-2"><SourceTag source={r.source} /></td>
                <td className="px-3 py-2"><Link to={to} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">{r.reference}</Link></td>
                <td className="px-3 py-2">{r.party}</td>
                <td className="px-3 py-2 text-gray-500">{r.categoryOrType}</td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(r.outstanding)}</td>
                <td className={`px-3 py-2 ${r.isOverdue ? 'font-medium text-red-600 dark:text-red-400' : 'text-gray-500'}`}>
                  {r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—'}{r.isOverdue ? ' · overdue' : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
