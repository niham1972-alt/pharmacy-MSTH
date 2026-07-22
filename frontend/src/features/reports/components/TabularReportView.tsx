import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { TabularReport } from '../types/reports.types';

const NON_MONEY = new Set(['days', 'daystoexpiry', 'items', 'quantity', 'qty', 'quantitysold', 'quantityreturned', 'count', 'orders', 'returns', 'receipts', 'transactions', 'transactioncount', 'units', 'shortfall', 'currentstock', 'reorderlevel', 'balanceafter', 'ontimepercent', 'varianceratepercent', 'grossmarginpercent', 'netmarginpercent', 'adjustments', 'unitslost', 'suppliers', 'batches', 'received', 'currentquantity', 'itemsbelowreorder', 'distincteventtypes', 'totalevents', 'events', 'purchases', 'totalunits', 'lifetimespend']);

function fmtCell(key: string, col: { numeric?: boolean }, v: string | number | null): string {
  if (v === null || v === undefined) return '—';
  if (col.numeric && typeof v === 'number') {
    const k = key.toLowerCase();
    if (NON_MONEY.has(k) || k.includes('percent') || k.includes('days')) return String(v);
    return formatCurrency(v);
  }
  return String(v);
}

/** Generic tabular renderer used by every non-statement report (spec §5/§9). */
export function TabularReportView({ report, isLoading, isError }: { report?: TabularReport; isLoading?: boolean; isError?: boolean }) {
  if (isError) return <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-6 text-center text-sm text-red-700 dark:text-red-300">Could not load this report.</div>;
  const cols = report?.columns ?? [];
  return (
    <div className="space-y-3">
      {report?.summary && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(report.summary).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2">
              <p className="text-[11px] uppercase text-gray-400">{k.replace(/([A-Z])/g, ' $1')}</p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{typeof v === 'number' && /amount|value|revenue|profit|spend|credit|outstanding|refund|tax|lost/i.test(k) ? formatCurrency(v) : String(v)}</p>
            </div>
          ))}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
            <tr>{cols.map((c) => <th key={c.key} className={`px-3 py-2 ${c.numeric ? 'text-right' : ''}`}>{c.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && <tr><td colSpan={cols.length || 1} className="px-3 py-8 text-center text-gray-400">Loading…</td></tr>}
            {!isLoading && report && report.rows.length === 0 && <tr><td colSpan={cols.length || 1} className="px-3 py-10 text-center text-gray-400">No data available for the selected period.</td></tr>}
            {report?.rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                {cols.map((c) => <td key={c.key} className={`px-3 py-2 ${c.numeric ? 'text-right tabular-nums' : ''}`}>{fmtCell(c.key, c, row[c.key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
