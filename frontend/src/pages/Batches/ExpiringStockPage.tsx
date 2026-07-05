import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useDashboardFilters } from '../../shared/store/dashboardFilters';
import { batchesApi, BatchRow, ExpiryTier } from '../../features/batches/api/batches.api';
import { ExpiryChip } from '../../features/batches/components/BatchStatusBadge';

const TIER_META: Record<Exclude<ExpiryTier, 'fresh'>, { title: string; cls: string }> = {
  red: { title: 'Critical — under 30 days', cls: 'text-red-700 dark:text-red-400' },
  orange: { title: 'Soon — 30 to 90 days', cls: 'text-orange-700 dark:text-orange-400' },
  yellow: { title: 'Watch — 90 to 180 days', cls: 'text-yellow-700 dark:text-yellow-500' },
};

export function ExpiringStockPage() {
  const navigate = useNavigate();
  const branchId = useDashboardFilters((s) => s.branchId);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['batches', 'expiring', branchId], queryFn: async () => (await batchesApi.expiring(180, branchId)).data });

  const groups: Array<[Exclude<ExpiryTier, 'fresh'>, BatchRow[]]> = (['red', 'orange', 'yellow'] as const).map((t) => [t, (data?.items ?? []).filter((i) => i.tier === t)]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-2 text-sm text-gray-500"><Link to="/batches" className="underline">Batches</Link> / Expiring Soon</div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Expiring Stock</h1>

      {isLoading && <div className="animate-pulse text-gray-400">Loading…</div>}
      {isError && <div className="text-red-600">Couldn't load. <button onClick={() => refetch()} className="underline">Retry</button></div>}
      {data && data.items.length === 0 && <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950 px-4 py-8 text-center text-green-700 dark:text-green-300">No batches expiring soon — you're in good shape. 🎉</div>}

      {data && groups.map(([tier, items]) => items.length > 0 && (
        <div key={tier} className="mb-6">
          <h2 className={`mb-2 text-sm font-semibold ${TIER_META[tier].cls}`}>{TIER_META[tier].title} ({items.length})</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Medicine</th><th className="px-3 py-2">Batch</th><th className="px-3 py-2">Expiry</th><th className="px-3 py-2 text-right">Qty</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((b) => (
                  <tr key={b.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40" onClick={() => navigate(`/batches/${b.id}`)}>
                    <td className="px-3 py-2 font-medium">{b.medicineName}</td>
                    <td className="px-3 py-2 text-gray-500">{b.batchNumber}</td>
                    <td className="px-3 py-2">{new Date(b.expiryDate).toLocaleDateString()} <ExpiryChip daysToExpiry={b.daysToExpiry} tier={b.tier} /></td>
                    <td className="px-3 py-2 text-right font-medium">{b.currentQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
