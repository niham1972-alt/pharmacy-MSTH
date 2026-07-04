import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { salesApi } from '../../features/pos/api/pos.api';

const STATUS_CLS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  VOIDED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  PARTIALLY_RETURNED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  FULLY_RETURNED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
};

export function SalesHistoryListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sales', 'list', { search, status, page }],
    queryFn: async () => {
      const res = await salesApi.list({ search: search || undefined, status: status || undefined, page, limit: 20 });
      return { data: res.data, meta: res.meta as { page: number; total: number; totalPages: number } };
    },
    placeholderData: keepPreviousData,
  });
  const rows = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Sales History</h1>
        {user?.role === 'cashier' && <span className="text-xs text-gray-400">Showing your sales only</span>}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search sale #…" className="w-56 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm">
          <option value="">Any status</option>
          <option value="COMPLETED">Completed</option>
          <option value="VOIDED">Voided</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
            <tr><th className="px-3 py-2">Sale #</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Items</th><th className="px-3 py-2">Payment</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && Array.from({ length: 6 }).map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={6} className="px-3 py-3"><div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800" /></td></tr>)}
            {isError && <tr><td colSpan={6} className="px-3 py-8 text-center"><p className="text-sm text-red-600">Couldn't load sales.</p><button onClick={() => refetch()} className="mt-1 text-sm underline">Retry</button></td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-500">No sales yet.</td></tr>}
            {rows.map((s) => (
              <tr key={s.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40" onClick={() => navigate(`/sales/${s.id}`)}>
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{s.saleNumber}</td>
                <td className="px-3 py-2 text-gray-500">{new Date(s.saleDate).toLocaleString()}</td>
                <td className="px-3 py-2 text-gray-500">{s.itemCount}</td>
                <td className="px-3 py-2 text-gray-500">{s.methods.join(', ')}</td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(s.grandTotal)}</td>
                <td className="px-3 py-2"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[s.status] ?? ''}`}>{s.status.replace(/_/g, ' ')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>{meta.total} sales · page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 disabled:opacity-40">Prev</button>
            <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
