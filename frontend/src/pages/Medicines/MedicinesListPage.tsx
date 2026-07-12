import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { useDashboardFilters } from '../../shared/store/dashboardFilters';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { useMedicinesList } from '../../features/medicines/hooks/useMedicines';
import { useLookups } from '../../features/medicines/hooks/useLookups';
import { StockStatusBadge, StatusBadge } from '../../features/medicines/components/StockStatusBadge';
import { MedicineFormModal } from '../../features/medicines/components/MedicineFormModal';

const CAN_EDIT = ['super_admin', 'admin', 'pharmacist', 'inventory_manager'];
const CAN_MANAGE = ['super_admin', 'admin', 'inventory_manager'];

export function MedicinesListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const branchId = useDashboardFilters((s) => s.branchId);
  const { categories, manufacturers } = useLookups();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [manufacturerId, setManufacturerId] = useState('');
  const [status, setStatus] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);

  const canEdit = CAN_EDIT.includes(user?.role ?? '');
  const canManage = CAN_MANAGE.includes(user?.role ?? '');
  const canSeeCost = user?.role !== 'cashier';

  const { data, isLoading, isError, refetch, isFetching } = useMedicinesList({
    page,
    limit: 15,
    search: search || undefined,
    branchId,
    categoryId: categoryId || undefined,
    manufacturerId: manufacturerId || undefined,
    status: status || undefined,
    stockStatus: stockStatus || undefined,
    sortBy,
    sortOrder,
  });

  const meta = data?.meta;
  const rows = data?.data ?? [];

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(col);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setCategoryId('');
    setManufacturerId('');
    setStatus('');
    setStockStatus('');
    setPage(1);
  };

  const hasFilters = !!(search || categoryId || manufacturerId || status || stockStatus);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Medicines</h1>
        <div className="flex items-center gap-2">
          {canManage && (
            <Link to="/medicines/lookups" className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300">
              Manage Lookups
            </Link>
          )}
          {canEdit && (
            <button type="button" onClick={() => setShowAdd(true)} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              + Add Medicine
            </button>
          )}
        </div>
      </div>

      {/* Search + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search name, generic, SKU, barcode…"
          aria-label="Search medicines"
          className="w-72 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
        />
        <select aria-label="Category" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Manufacturer" value={manufacturerId} onChange={(e) => { setManufacturerId(e.target.value); setPage(1); }} className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm">
          <option value="">All manufacturers</option>
          {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select aria-label="Stock status" value={stockStatus} onChange={(e) => { setStockStatus(e.target.value); setPage(1); }} className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm">
          <option value="">Any stock</option>
          <option value="in_stock">In stock</option>
          <option value="low">Low</option>
          <option value="out">Out of stock</option>
        </select>
        <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm">
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="DISCONTINUED">Discontinued</option>
        </select>
        {hasFilters && <button onClick={resetFilters} className="text-sm text-brand-600 dark:text-brand-400 underline">Clear</button>}
        {isFetching && <span className="text-xs text-gray-400">Updating…</span>}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
            <tr>
              <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort('name')}>Name {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Form</th>
              <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort('stock')}>Stock {sortBy === 'stock' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</th>
              <th className="cursor-pointer px-3 py-2 text-right" onClick={() => toggleSort('price')}>Price {sortBy === 'price' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</th>
              {canSeeCost && <th className="px-3 py-2 text-right">Margin</th>}
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={canSeeCost ? 8 : 7} className="px-3 py-3">
                    <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800" />
                  </td>
                </tr>
              ))}

            {isError && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center">
                  <p className="text-sm text-red-600 dark:text-red-400">Couldn't load medicines.</p>
                  <button onClick={() => refetch()} className="mt-1 text-sm underline">Retry</button>
                </td>
              </tr>
            )}

            {!isLoading && !isError && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-gray-500">
                  {hasFilters ? 'No medicines match your filters.' : 'No medicines yet.'}
                  {canEdit && !hasFilters && (
                    <div className="mt-2">
                      <button type="button" onClick={() => setShowAdd(true)} className="text-brand-600 dark:text-brand-400 underline">Add your first product</button>
                    </div>
                  )}
                </td>
              </tr>
            )}

            {rows.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                <td className="px-3 py-2">
                  <button onClick={() => navigate(`/medicines/${m.id}`)} className="text-left">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{m.name}</span>
                    {m.strength && <span className="text-gray-400"> · {m.strength}</span>}
                    <div className="text-xs text-gray-400">{m.genericName} · {m.sku}{m.prescriptionRequired ? ' · ℞' : ''}</div>
                  </button>
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{m.category?.name}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{m.dosageForm?.name}</td>
                <td className="px-3 py-2"><StockStatusBadge status={m.stockStatus} count={m.currentStock} /></td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(m.sellingPrice)}</td>
                {canSeeCost && <td className="px-3 py-2 text-right text-gray-500">{m.margin != null ? `${m.margin}%` : '—'}</td>}
                <td className="px-3 py-2"><StatusBadge status={m.status} /></td>
                <td className="px-3 py-2 text-right">
                  <Link to={`/medicines/${m.id}`} className="text-brand-600 dark:text-brand-400 text-xs underline">View</Link>
                  {canEdit && <Link to={`/medicines/${m.id}/edit`} className="ml-2 text-brand-600 dark:text-brand-400 text-xs underline">Edit</Link>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>{meta.total} medicines · page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 disabled:opacity-40">Prev</button>
            <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {showAdd && (
        <MedicineFormModal
          onClose={() => setShowAdd(false)}
          onSaved={(id) => { setShowAdd(false); navigate(`/medicines/${id}`); }}
        />
      )}
    </div>
  );
}
