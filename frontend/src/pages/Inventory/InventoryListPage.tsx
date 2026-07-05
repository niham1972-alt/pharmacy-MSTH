import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { useDashboardFilters } from '../../shared/store/dashboardFilters';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { StockStatusBadge } from '../../features/medicines/components/StockStatusBadge';
import { inventoryApi } from '../../features/inventory/api/inventory.api';

const MANAGE = ['super_admin', 'admin', 'inventory_manager'];
const VALUATION = ['super_admin', 'admin', 'inventory_manager', 'accountant', 'auditor'];

export function InventoryListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const branchId = useDashboardFilters((s) => s.branchId);
  const [search, setSearch] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [page, setPage] = useState(1);

  const canManage = MANAGE.includes(user?.role ?? '');
  const canValue = VALUATION.includes(user?.role ?? '');
  const canSeeCost = user?.role !== 'cashier';

  const summary = useQuery({ queryKey: ['inventory', 'summary', branchId], queryFn: async () => (await inventoryApi.summary(branchId)).data, enabled: canValue });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory', 'list', { search, stockStatus, page, branchId }],
    queryFn: async () => {
      const res = await inventoryApi.list({ search: search || undefined, stockStatus: stockStatus || undefined, page, limit: 20, branchId });
      return { data: res.data, meta: res.meta as { page: number; total: number; totalPages: number } };
    },
    placeholderData: keepPreviousData,
  });
  const rows = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Inventory</h1>
        {canManage && (
          <div className="flex gap-2">
            <Link to="/inventory/reorder" className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Reorder Suggestions</Link>
            <Link to="/inventory/reconciliation" className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Reconciliation</Link>
          </div>
        )}
      </div>

      {canValue && summary.data && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Total SKUs', String(summary.data.totalSkus)],
            ['Stock Value', formatCurrency(summary.data.totalStockValue)],
            ['Low Stock', String(summary.data.lowStockCount)],
            ['Out of Stock', String(summary.data.outOfStockCount)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name / SKU…" className="w-64 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm" />
        <select value={stockStatus} onChange={(e) => { setStockStatus(e.target.value); setPage(1); }} className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm">
          <option value="">Any stock</option>
          <option value="in_stock">In stock</option>
          <option value="low">Low</option>
          <option value="out">Out of stock</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Medicine</th><th className="px-3 py-2">Category</th><th className="px-3 py-2 text-right">Stock</th>
              <th className="px-3 py-2">Status</th>{canSeeCost && <th className="px-3 py-2 text-right">Value</th>}<th className="px-3 py-2">Last moved</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && Array.from({ length: 6 }).map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={6} className="px-3 py-3"><div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800" /></td></tr>)}
            {isError && <tr><td colSpan={6} className="px-3 py-8 text-center"><p className="text-sm text-red-600">Couldn't load inventory.</p><button onClick={() => refetch()} className="mt-1 text-sm underline">Retry</button></td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-500">No stock records yet — stock appears here once you receive your first purchase.</td></tr>}
            {rows.map((r) => (
              <tr key={r.medicineId} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40" onClick={() => navigate(`/inventory/${r.medicineId}`)}>
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{r.name}<span className="block text-xs text-gray-400">{r.sku}</span></td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{r.category}</td>
                <td className="px-3 py-2 text-right font-medium">{r.currentStock}</td>
                <td className="px-3 py-2"><StockStatusBadge status={r.stockStatus} /></td>
                {canSeeCost && <td className="px-3 py-2 text-right text-gray-500">{r.stockValue != null ? formatCurrency(r.stockValue) : '—'}</td>}
                <td className="px-3 py-2 text-gray-500">{new Date(r.lastMovementAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>{meta.total} items · page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 disabled:opacity-40">Prev</button>
            <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
