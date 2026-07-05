import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { useDashboardFilters } from '../../shared/store/dashboardFilters';
import { batchesApi } from '../../features/batches/api/batches.api';
import { WriteOffModal } from '../../features/batches/components/WriteOffModal';

const CAN_WRITE_OFF = ['super_admin', 'admin', 'inventory_manager'];

export function ExpiredStockReviewPage() {
  const { user } = useAuth();
  const branchId = useDashboardFilters((s) => s.branchId);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [showModal, setShowModal] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['batches', 'expired', branchId], queryFn: async () => (await batchesApi.expired(branchId)).data });

  const rows = data ?? [];
  const canWriteOff = CAN_WRITE_OFF.includes(user?.role ?? '');
  const chosen = rows.filter((r) => selected[r.id]);
  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-2 text-sm text-gray-500"><Link to="/batches" className="underline">Batches</Link> / Expired Stock</div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Expired Stock Review</h1>
        {canWriteOff && chosen.length > 0 && <button onClick={() => setShowModal(true)} className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700">Write Off {chosen.length}</button>}
      </div>

      {isLoading && <div className="animate-pulse text-gray-400">Loading…</div>}
      {isError && <div className="text-red-600">Couldn't load. <button onClick={() => refetch()} className="underline">Retry</button></div>}
      {data && rows.length === 0 && <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950 px-4 py-8 text-center text-green-700 dark:text-green-300">No expired stock — nothing to review. 🎉</div>}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500"><tr>{canWriteOff && <th className="px-3 py-2 w-8"></th>}<th className="px-3 py-2">Medicine</th><th className="px-3 py-2">Batch</th><th className="px-3 py-2">Expired</th><th className="px-3 py-2 text-right">Qty</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((b) => (
                <tr key={b.id}>
                  {canWriteOff && <td className="px-3 py-2"><input type="checkbox" checked={!!selected[b.id]} onChange={() => toggle(b.id)} aria-label={`Select ${b.batchNumber}`} /></td>}
                  <td className="px-3 py-2 font-medium"><Link to={`/batches/${b.id}`} className="hover:underline">{b.medicineName}</Link></td>
                  <td className="px-3 py-2 text-gray-500">{b.batchNumber}</td>
                  <td className="px-3 py-2 text-red-600">{new Date(b.expiryDate).toLocaleDateString()} ({Math.abs(b.daysToExpiry)}d ago)</td>
                  <td className="px-3 py-2 text-right font-medium">{b.currentQuantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <WriteOffModal batches={chosen} onClose={() => setShowModal(false)} onDone={() => { setShowModal(false); setSelected({}); refetch(); }} />}
    </div>
  );
}
