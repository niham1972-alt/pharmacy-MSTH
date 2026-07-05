import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { customersApi } from '../../features/customers/api/customers.api';

const WRITE = ['super_admin', 'admin', 'pharmacist'];
const SPEND = ['super_admin', 'admin', 'accountant', 'auditor'];
const HEALTH = ['super_admin', 'admin', 'pharmacist'];

export function CustomersListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [tagId, setTagId] = useState('');
  const [hasAllergies, setHasAllergies] = useState(false);
  const [page, setPage] = useState(1);

  const canWrite = WRITE.includes(user?.role ?? '');
  const canSpend = SPEND.includes(user?.role ?? '');
  const canHealth = HEALTH.includes(user?.role ?? '');

  const tagsQ = useQuery({ queryKey: ['customer-tags'], queryFn: async () => (await customersApi.tags()).data });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customers', 'list', { search, tagId, hasAllergies, page }],
    queryFn: async () => {
      const res = await customersApi.list({ search: search || undefined, tagId: tagId || undefined, hasAllergiesFlag: hasAllergies ? 'true' : undefined, page, limit: 20 });
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
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Customers</h1>
        <div className="flex gap-2">
          {canWrite && <Link to="/customers/merge" className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Merge Duplicates</Link>}
          {canWrite && <Link to="/customers/new" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">+ New Customer</Link>}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name / phone / email…" className={`w-64 ${input}`} />
        <select value={tagId} onChange={(e) => { setTagId(e.target.value); setPage(1); }} className={input}><option value="">Any tag</option>{tagsQ.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        {canHealth && <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400"><input type="checkbox" checked={hasAllergies} onChange={(e) => { setHasAllergies(e.target.checked); setPage(1); }} />Has allergies</label>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
            <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Phone</th><th className="px-3 py-2">Tags</th><th className="px-3 py-2">Last Purchase</th>{canSpend && <th className="px-3 py-2 text-right">Lifetime Spend</th>}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && Array.from({ length: 5 }).map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={5} className="px-3 py-3"><div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800" /></td></tr>)}
            {isError && <tr><td colSpan={5} className="px-3 py-8 text-center"><p className="text-sm text-red-600">Couldn't load customers.</p><button onClick={() => refetch()} className="mt-1 text-sm underline">Retry</button></td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-500">No customers yet — quick-add one at the POS, or {canWrite && <Link to="/customers/new" className="underline">register a full profile</Link>}.</td></tr>}
            {rows.map((c) => (
              <tr key={c.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40" onClick={() => navigate(`/customers/${c.id}`)}>
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{c.name}{c.prescriptionCount > 0 && <span className="ml-2 rounded bg-brand-50 dark:bg-brand-700/20 px-1.5 py-0.5 text-xs text-brand-700 dark:text-brand-400">℞ {c.prescriptionCount}</span>}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{c.phone}</td>
                <td className="px-3 py-2">{c.tags.map((t) => <span key={t.id} className="mr-1 inline-block rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: (t.color ?? '#e5e7eb') + '33', color: t.color ?? '#374151' }}>{t.name}</span>)}</td>
                <td className="px-3 py-2 text-gray-500">{c.lastPurchaseAt ? new Date(c.lastPurchaseAt).toLocaleDateString() : '—'}</td>
                {canSpend && <td className="px-3 py-2 text-right text-gray-500">{c.lifetimeSpend != null ? formatCurrency(c.lifetimeSpend) : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>{meta.total} customers · page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 disabled:opacity-40">Prev</button>
            <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
