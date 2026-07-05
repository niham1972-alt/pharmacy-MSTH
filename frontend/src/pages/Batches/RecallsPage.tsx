import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { ApiClientError } from '../../shared/api/client';
import { AffectedSale, batchesApi, RecallRow } from '../../features/batches/api/batches.api';

const CAN_RESOLVE = ['super_admin', 'admin', 'pharmacist'];
const RESOLUTIONS = [
  { value: 'RETURNED_TO_SUPPLIER', label: 'Returned to supplier' },
  { value: 'DESTROYED', label: 'Destroyed' },
  { value: 'RESOLVED_OTHER', label: 'Resolved (other)' },
];

export function RecallsPage() {
  const { user } = useAuth();
  const [affected, setAffected] = useState<{ recall: RecallRow; sales: AffectedSale[] } | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolution, setResolution] = useState('RETURNED_TO_SUPPLIER');
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['batches', 'recalls'], queryFn: async () => (await batchesApi.recallList()).data });

  const rows = data ?? [];
  const canResolve = CAN_RESOLVE.includes(user?.role ?? '');

  const viewAffected = async (r: RecallRow) => {
    try {
      const sales = (await batchesApi.affectedSales(r.id)).data;
      setAffected({ recall: r, sales });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load affected sales.');
    }
  };

  const resolve = async (id: string) => {
    setError(null);
    try {
      await batchesApi.resolveRecall(id, { resolutionStatus: resolution });
      setResolvingId(null);
      refetch();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to resolve.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-2 text-sm text-gray-500"><Link to="/batches" className="underline">Batches</Link> / Recalls</div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Batch Recalls</h1>
      <p className="mb-4 text-sm text-gray-500">Recalled batches are blocked from every sale system-wide. To recall a batch, open it from the batch list and click <strong>Flag Recall</strong>.</p>

      {error && <div role="alert" className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {isLoading && <div className="animate-pulse text-gray-400">Loading…</div>}
      {isError && <div className="text-red-600">Couldn't load recalls. <button onClick={() => refetch()} className="underline">Retry</button></div>}
      {data && rows.length === 0 && <div className="rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-8 text-center text-gray-500">No active recalls.</div>}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Medicine</th><th className="px-3 py-2">Batch</th><th className="px-3 py-2">Reason</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-medium"><Link to={`/batches/${r.batchId}`} className="hover:underline">{r.medicineName}</Link></td>
                  <td className="px-3 py-2 text-gray-500">{r.batchNumber}</td>
                  <td className="px-3 py-2 max-w-xs truncate" title={r.reason}>{r.reason}</td>
                  <td className="px-3 py-2">{r.resolvedAt ? <span className="text-green-600">{r.resolutionStatus}</span> : <span className="text-purple-600">{r.resolutionStatus}</span>}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => viewAffected(r)} className="mr-2 text-xs underline text-gray-600 dark:text-gray-400">Affected sales</button>
                    {canResolve && !r.resolvedAt && (resolvingId === r.id ? (
                      <span className="inline-flex items-center gap-1">
                        <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-xs">{RESOLUTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                        <button onClick={() => resolve(r.id)} className="text-xs text-green-600 underline">Save</button>
                      </span>
                    ) : (
                      <button onClick={() => setResolvingId(r.id)} className="text-xs underline text-brand-600">Resolve</button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {affected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-lg bg-white dark:bg-gray-900 p-5 shadow-xl">
            <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-semibold">Affected sales — {affected.recall.batchNumber}</h2><button onClick={() => setAffected(null)} className="text-gray-400">✕</button></div>
            {affected.sales.length === 0 ? (
              <p className="py-4 text-sm text-gray-500">No units of this batch were sold before the recall.</p>
            ) : (
              <div className="max-h-72 overflow-auto text-sm">
                {affected.sales.map((s) => (
                  <div key={s.saleId} className="flex justify-between border-b border-gray-100 dark:border-gray-800 py-1.5">
                    <Link to={`/sales/${s.saleId}`} className="underline">{s.saleNumber}</Link>
                    <span className="text-gray-500">{new Date(s.saleDate).toLocaleDateString()} · {s.quantity} units</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
