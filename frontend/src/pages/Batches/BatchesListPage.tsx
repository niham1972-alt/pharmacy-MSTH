import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useDashboardFilters } from '../../shared/store/dashboardFilters';
import { batchesApi } from '../../features/batches/api/batches.api';
import { BatchStatusBadge, ExpiryChip } from '../../features/batches/components/BatchStatusBadge';

const STATUSES = ['FRESH', 'EXPIRING_SOON', 'EXPIRED', 'DEPLETED', 'RECALLED'];

export function BatchesListPage() {
  const navigate = useNavigate();
  const branchId = useDashboardFilters((s) => s.branchId);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['batches', 'list', { search, status, page, branchId }],
    queryFn: async () => {
      const res = await batchesApi.list({ search: search || undefined, status: status || undefined, page, limit: 20, branchId });
      return { data: res.data, meta: res.meta as { page: number; total: number; totalPages: number } };
    },
    placeholderData: keepPreviousData,
  });
  const rows = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Batches &amp; Expiry</h1>
        <div className="flex gap-2">
          <Link to="/batches/expiring" className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Expiring Soon</Link>
          <Link to="/batches/expired" className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Expired Stock</Link>
          <Link to="/batches/recalls" className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Recalls</Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search batch no. / medicine…" className="w-64 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm">
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Medicine</th><th className="px-3 py-2">Batch</th><th className="px-3 py-2">Expiry</th>
              <th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && Array.from({ length: 6 }).map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={6} className="px-3 py-3"><div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800" /></td></tr>)}
            {isError && <tr><td colSpan={6} className="px-3 py-8 text-center"><p className="text-sm text-red-600">Couldn't load batches.</p><button onClick={() => refetch()} className="mt-1 text-sm underline">Retry</button></td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-500">No batches recorded yet — batches appear here once you receive a purchase.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40" onClick={() => navigate(`/batches/${r.id}`)}>
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{r.medicineName}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{r.batchNumber}</td>
                <td className="px-3 py-2"><span className="text-gray-600 dark:text-gray-400">{new Date(r.expiryDate).toLocaleDateString()}</span> <ExpiryChip daysToExpiry={r.daysToExpiry} tier={r.tier} /></td>
                <td className="px-3 py-2 text-right font-medium">{r.currentQuantity}</td>
                <td className="px-3 py-2"><BatchStatusBadge batch={r} /></td>
                <td className="px-3 py-2 text-gray-500">{new Date(r.receivedDate).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>{meta.total} batches · page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 disabled:opacity-40">Prev</button>
            <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
