import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { platformApi } from '../api/platform.api';
import { TenantStatusBadge } from '../components/TenantStatusBadge';

const STATUSES = ['', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'ARCHIVED'];

export function TenantsListPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const { data: plans } = useQuery({ queryKey: ['platform', 'plans'], queryFn: async () => (await platformApi.plans()).data });
  const [planId, setPlanId] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'tenants', search, status, planId],
    queryFn: async () => (await platformApi.tenants({ search: search || undefined, status: status || undefined, planId: planId || undefined, limit: '100' })).data,
  });

  const input = 'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Tenants</h1>
        <Link to="/platform-admin/tenants/new" className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">+ Onboard Tenant</Link>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / email…" className={`${input} w-64`} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace('_', ' ') : 'All statuses'}</option>)}
        </select>
        <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={input}>
          <option value="">All plans</option>
          {plans?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-slate-900/40">
            <tr><th className="px-3 py-2">Business</th><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Users</th><th className="px-3 py-2">Trial ends</th><th className="px-3 py-2">Created</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {isLoading && <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Loading…</td></tr>}
            {!isLoading && data?.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-400">No tenants yet — onboard your first pharmacy client.</td></tr>}
            {data?.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-900/40">
                <td className="px-3 py-2"><Link to={`/platform-admin/tenants/${t.id}`} className="font-medium text-indigo-600 hover:underline">{t.businessName}</Link><div className="text-xs text-gray-400">{t.contactEmail}</div></td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{t.planName ?? '—'}</td>
                <td className="px-3 py-2"><TenantStatusBadge status={t.status} /></td>
                <td className="px-3 py-2">{t.userCount}</td>
                <td className="px-3 py-2 text-gray-500">{t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString() : '—'}</td>
                <td className="px-3 py-2 text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
