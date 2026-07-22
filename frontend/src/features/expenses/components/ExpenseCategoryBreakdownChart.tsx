import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { ExpenseSummary } from '../types/expense.types';

// Reuses Dashboard's charting conventions (recharts) for visual consistency (spec §9).
const COLORS = ['#2563eb', '#009e73', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4b5563'];

export function ExpenseCategoryBreakdownChart({ summary }: { summary?: ExpenseSummary }) {
  const data = (summary?.byCategory ?? []).map((c) => ({ name: c.label, total: c.total }));
  if (data.length === 0) {
    return <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center text-sm text-gray-400">No expense data for this period.</div>;
  }
  return (
    <div style={{ width: '100%', height: Math.max(200, data.length * 40) }} role="img" aria-label="Expense breakdown by category">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 24, right: 24 }}>
          <XAxis type="number" fontSize={12} tickFormatter={(v: number) => formatCurrency(v)} />
          <YAxis type="category" dataKey="name" fontSize={12} width={140} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
