import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { PnlStatement } from '../types/reports.types';

function Row({ label, value, bold, indent, muted, accent }: { label: string; value: number; bold?: boolean; indent?: boolean; muted?: boolean; accent?: boolean }) {
  return (
    <div className={`flex items-center justify-between border-b border-gray-100 dark:border-gray-800 py-2 ${indent ? 'pl-6' : ''}`}>
      <span className={`${bold ? 'font-semibold' : ''} ${muted ? 'text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-semibold' : ''} ${accent ? (value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : muted ? 'text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

/**
 * Formal, presentation-grade P&L statement (spec §5/§9 — the most externally-facing
 * report). Deliberately statement-styled, not a raw data grid. Print-friendly.
 */
export function ProfitLossStatementView({ pnl }: { pnl: PnlStatement }) {
  const period = `${new Date(pnl.dateFrom).toLocaleDateString()} – ${new Date(pnl.dateTo).toLocaleDateString()}`;
  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
      <div className="mb-4 text-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Profit &amp; Loss Statement</h2>
        <p className="text-sm text-gray-500">{period}</p>
      </div>

      <Row label="Gross revenue" value={pnl.grossRevenue} />
      <Row label="Less: sales returns" value={-pnl.returnsAmount} indent muted />
      <Row label="Net revenue" value={pnl.netRevenue} bold />
      <Row label="Less: cost of goods sold" value={-pnl.costOfGoodsSold} indent muted />
      <Row label="Gross profit" value={pnl.grossProfit} bold />
      <div className={`flex items-center justify-between py-1 text-xs ${pnl.grossMarginPercent >= 0 ? 'text-gray-500' : 'text-red-500'}`}>
        <span className="pl-6">Gross margin</span><span>{pnl.grossMarginPercent}%</span>
      </div>

      <p className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Operating expenses</p>
      {pnl.expensesByCategory.length === 0 && <p className="py-2 pl-6 text-sm text-gray-400">No operating expenses in this period.</p>}
      {pnl.expensesByCategory.map((c) => <Row key={c.categoryId} label={c.categoryName} value={-c.amount} indent muted />)}
      <Row label="Total operating expenses" value={-pnl.totalOperatingExpenses} />

      <div className="mt-2 rounded-md bg-gray-50 dark:bg-gray-800/60 px-3">
        <Row label="NET PROFIT" value={pnl.netProfit} bold accent />
      </div>
      <div className="flex items-center justify-between py-1 text-xs text-gray-500">
        <span className="pl-6">Net margin</span><span>{pnl.netMarginPercent}%</span>
      </div>

      {pnl.pendingExpensesAmount > 0 && (
        <p className="mt-3 rounded-md bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-700 dark:text-amber-300">
          Excludes {formatCurrency(pnl.pendingExpensesAmount)} of pending-approval expenses (not yet confirmed costs). Net profit if approved: {formatCurrency(pnl.netProfitIfPendingApproved)}.
        </p>
      )}
      <p className="mt-3 text-right text-xs text-gray-400">Tax collected on sales in period: {formatCurrency(pnl.taxCollected)}</p>
    </div>
  );
}
