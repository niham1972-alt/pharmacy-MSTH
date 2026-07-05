import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { suppliersApi, SUPPLIER_TYPES } from '../../features/suppliers/api/suppliers.api';
import { ActiveBadge, LicenseBadge, TypeBadge } from '../../features/suppliers/components/SupplierStatusBadges';

const MANAGE = ['super_admin', 'admin', 'inventory_manager'];
const PAYABLES = ['super_admin', 'admin', 'accountant', 'auditor'];

export function SuppliersListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [supplierType, setSupplierType] = useState('');
  const [isActive, setIsActive] = useState('true');
  const [licenseStatus, setLicenseStatus] = useState('');
  const [page, setPage] = useState(1);

  const canManage = MANAGE.includes(user?.role ?? '');
  const canSeeMoney = PAYABLES.includes(user?.role ?? '') || user?.role === 'inventory_manager';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['suppliers', 'list', { search, supplierType, isActive, licenseStatus, page }],
    queryFn: async () => {
      const res = await suppliersApi.list({ search: search || undefined, supplierType: supplierType || undefined, isActive: isActive || undefined, licenseStatus: licenseStatus || undefined, page, limit: 20 });
      return { data: res.data, meta: res.meta as { page: number; total: number; totalPages: number } };
    },
    placeholderData: keepPreviousData,
  });
  const rows = data?.data ?? [];
  const meta = data?.meta;
  const input = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Suppliers</h1>
        <div className="flex gap-2">
          <Link to="/suppliers/attention" className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Needing Attention</Link>
          {canManage && <Link to="/suppliers/new" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">+ New Supplier</Link>}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search company / tax no…" className={`w-64 ${input}`} />
        <select value={supplierType} onChange={(e) => { setSupplierType(e.target.value); setPage(1); }} className={input}><option value="">Any type</option>{SUPPLIER_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select>
        <select value={isActive} onChange={(e) => { setIsActive(e.target.value); setPage(1); }} className={input}><option value="">All</option><option value="true">Active</option><option value="false">Archived</option></select>
        <select value={licenseStatus} onChange={(e) => { setLicenseStatus(e.target.value); setPage(1); }} className={input}><option value="">Any license</option><option value="valid">Valid</option><option value="expiring">Expiring</option><option value="expired">Expired</option></select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
            <tr><th className="px-3 py-2">Company</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">License</th>{canSeeMoney && <th className="px-3 py-2 text-right">Spend</th>}{canSeeMoney && <th className="px-3 py-2 text-right">Outstanding</th>}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && Array.from({ length: 5 }).map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={6} className="px-3 py-3"><div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800" /></td></tr>)}
            {isError && <tr><td colSpan={6} className="px-3 py-8 text-center"><p className="text-sm text-red-600">Couldn't load suppliers.</p><button onClick={() => refetch()} className="mt-1 text-sm underline">Retry</button></td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-500">No suppliers yet — add your first supplier to start creating purchase orders.</td></tr>}
            {rows.map((s) => (
              <tr key={s.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40" onClick={() => navigate(`/suppliers/${s.id}`)}>
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{s.companyName}{s.tradingName && <span className="block text-xs text-gray-400">{s.tradingName}</span>}</td>
                <td className="px-3 py-2"><TypeBadge type={s.supplierType} /></td>
                <td className="px-3 py-2"><ActiveBadge isActive={s.isActive} /></td>
                <td className="px-3 py-2"><LicenseBadge status={s.licenseStatus} daysToExpiry={s.licenseDaysToExpiry} /></td>
                {canSeeMoney && <td className="px-3 py-2 text-right text-gray-500">{formatCurrency(s.totalSpend)}</td>}
                {canSeeMoney && <td className={`px-3 py-2 text-right font-medium ${s.outstanding > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{s.outstanding > 0 ? formatCurrency(s.outstanding) : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>{meta.total} suppliers · page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 disabled:opacity-40">Prev</button>
            <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
