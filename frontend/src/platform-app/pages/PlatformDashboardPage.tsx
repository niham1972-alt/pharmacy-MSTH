import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { platformApi } from '../api/platform.api';
import { TenantStatusBadge } from '../components/TenantStatusBadge';

function Kpi({ label, value, tone = '' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone || 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
    </div>
  );
}

export function PlatformDashboardPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['platform', 'dashboard'], queryFn: async () => (await platformApi.dashboard()).data });

  if (isLoading) return <p className="text-sm text-gray-500">Loading platform metrics…</p>;
  if (isError || !data) return <p className="text-sm text-red-600">Couldn't load platform metrics.</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Platform Overview</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Kpi label="Total Tenants" value={data.totalTenants} />
        <Kpi label="Active" value={data.activeTenants} tone="text-green-600" />
        <Kpi label="Trial" value={data.trialTenants} tone="text-blue-600" />
        <Kpi label="Past Due" value={data.pastDueTenants} tone="text-orange-600" />
        <Kpi label="Suspended" value={data.suspendedTenants} tone="text-red-600" />
        <Kpi label="Archived" value={data.archivedTenants} tone="text-gray-500" />
        <Kpi label="MRR" value={formatCurrency(data.mrr)} tone="text-indigo-600" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="New signups (30d)" value={data.newSignups30d} />
        <Kpi label="Trial → Paid" value={`${data.trialToPaidRate}%`} />
        <Kpi label="Platform txns" value={data.platformTransactionCount} />
        <Kpi label="Txn volume" value={formatCurrency(data.platformTransactionVolume)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">⚠ Tenants Needing Attention</h2>
          {data.tenantsNeedingAttention.length === 0 && <p className="text-sm text-gray-400">All good — nothing needs attention.</p>}
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {data.tenantsNeedingAttention.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-1.5 text-sm">
                <Link to={`/platform-admin/tenants/${t.id}`} className="font-medium text-indigo-600 hover:underline">{t.businessName}</Link>
                <TenantStatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">⏳ Expiring Trials (next 7 days)</h2>
          {data.expiringTrials.length === 0 && <p className="text-sm text-gray-400">No trials expiring soon.</p>}
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {data.expiringTrials.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-1.5 text-sm">
                <Link to={`/platform-admin/tenants/${t.id}`} className="font-medium text-indigo-600 hover:underline">{t.businessName}</Link>
                <span className="text-gray-500">{t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString() : '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-right text-xs text-gray-400">Aggregates cached ~5 min · generated {new Date(data.generatedAt).toLocaleTimeString()}</p>
    </div>
  );
}
