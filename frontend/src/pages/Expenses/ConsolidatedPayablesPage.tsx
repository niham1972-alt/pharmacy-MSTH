import { Link } from 'react-router-dom';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { useConsolidatedPayables } from '../../features/expenses/hooks/useConsolidatedPayables';
import { ConsolidatedPayablesTable } from '../../features/expenses/components/ConsolidatedPayablesTable';

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
      <p className="text-xs uppercase text-gray-400">{label}</p>
      <p className={`text-lg font-semibold ${accent ?? 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
    </div>
  );
}

export function ConsolidatedPayablesPage() {
  const { data, isLoading } = useConsolidatedPayables();
  const totals = data?.totals;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Consolidated Payables</h1>
        <Link to="/expenses" className="text-sm text-brand-600 hover:underline">← Back to expenses</Link>
        <p className="mt-1 text-sm text-gray-500">Everything the pharmacy currently owes — operating expenses and supplier purchase orders in one due-date-sorted view. Purchase orders are read-only here; settle them in Purchases.</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total outstanding" value={formatCurrency(totals?.totalOutstanding ?? 0)} />
        <StatCard label="Overdue" value={formatCurrency(totals?.overdueOutstanding ?? 0)} accent="text-red-600 dark:text-red-400" />
        <StatCard label="Expenses" value={formatCurrency(totals?.expenseOutstanding ?? 0)} />
        <StatCard label="Purchase orders" value={formatCurrency(totals?.purchaseOrderOutstanding ?? 0)} />
      </div>

      <ConsolidatedPayablesTable rows={data?.rows} isLoading={isLoading} />
    </div>
  );
}
