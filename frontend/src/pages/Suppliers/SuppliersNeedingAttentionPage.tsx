import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { suppliersApi } from '../../features/suppliers/api/suppliers.api';
import { LicenseBadge } from '../../features/suppliers/components/SupplierStatusBadges';

export function SuppliersNeedingAttentionPage() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['suppliers', 'attention'], queryFn: async () => (await suppliersApi.needingAttention()).data });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-2 text-sm text-gray-500"><Link to="/suppliers" className="underline">Suppliers</Link> / Needing Attention</div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Suppliers Needing Attention</h1>

      {isLoading && <div className="animate-pulse text-gray-400">Loading…</div>}
      {isError && <div className="text-red-600">Couldn't load. <button onClick={() => refetch()} className="underline">Retry</button></div>}

      {data && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Licenses expiring / expired ({data.licenseRisk.length})</h2>
          <div className="mb-6 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Company</th><th className="px-3 py-2">License</th><th className="px-3 py-2">Expiry</th><th className="px-3 py-2">Status</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.licenseRisk.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-green-700 dark:text-green-300">All licenses valid. 🎉</td></tr>}
                {data.licenseRisk.map((s) => (
                  <tr key={s.id}><td className="px-3 py-2 font-medium"><Link to={`/suppliers/${s.id}`} className="hover:underline">{s.companyName}</Link></td><td className="px-3 py-2 text-gray-500">{s.drugLicenseNumber ?? '—'}</td><td className="px-3 py-2 text-gray-500">{s.drugLicenseExpiry ? new Date(s.drugLicenseExpiry).toLocaleDateString() : '—'}</td><td className="px-3 py-2"><LicenseBadge status={s.status} daysToExpiry={s.daysToExpiry} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Outstanding payables ({data.overduePayables.length})</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Company</th><th className="px-3 py-2">Open POs</th><th className="px-3 py-2 text-right">Outstanding</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.overduePayables.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-500">Nothing outstanding.</td></tr>}
                {data.overduePayables.map((p) => (
                  <tr key={p.supplierId}><td className="px-3 py-2 font-medium"><Link to={`/suppliers/${p.supplierId}`} className="hover:underline">{p.companyName}</Link>{!p.isActive && <span className="ml-2 rounded bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 text-xs">archived</span>}</td><td className="px-3 py-2 text-gray-500">{p.openPoCount}</td><td className="px-3 py-2 text-right font-medium text-orange-600">{formatCurrency(p.outstanding)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
