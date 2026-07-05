import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ApiClientError } from '../../shared/api/client';
import { useMedicineSearch } from '../../features/medicines/hooks/useMedicines';
import { inventoryApi } from '../../features/inventory/api/inventory.api';
import { useDashboardFilters } from '../../shared/store/dashboardFilters';

export function ReconciliationPage() {
  const branchId = useDashboardFilters((s) => s.branchId);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const [term, setTerm] = useState('');
  const [counted, setCounted] = useState('');
  const [result, setResult] = useState<{ expectedQuantity: number; countedQuantity: number; variance: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: searchResults } = useMedicineSearch(term);
  const listQ = useQuery({ queryKey: ['inventory', 'reconciliation', branchId], queryFn: async () => (await inventoryApi.reconciliationList(branchId)).data });

  const submit = async () => {
    if (!picked || counted === '') return;
    setBusy(true);
    setError(null);
    try {
      const res = await inventoryApi.reconcile({ medicineId: picked.id, countedQuantity: Number(counted) });
      setResult(res.data);
      listQ.refetch();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to submit count.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 text-sm text-gray-500"><Link to="/inventory" className="underline">Inventory</Link> / Reconciliation</div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Stock Reconciliation</h1>

      <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <p className="mb-2 text-sm text-gray-500">Physically count a medicine and enter the quantity — the system shows the variance vs. expected. This is informational; correcting stock is a Stock Adjustment (Module 11).</p>
        {error && <div role="alert" className="mb-2 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative">
            <label className="text-xs text-gray-500">Medicine</label>
            {picked ? (
              <div className="flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm"><span>{picked.name}</span><button onClick={() => { setPicked(null); setResult(null); }} className="text-gray-400">✕</button></div>
            ) : (
              <>
                <input className={input} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search medicine…" />
                {term.trim().length >= 2 && (
                  <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm shadow-lg">
                    {searchResults?.map((m) => <li key={m.id}><button onClick={() => { setPicked({ id: m.id, name: m.name }); setTerm(''); }} className="block w-full px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700">{m.name}</button></li>)}
                  </ul>
                )}
              </>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500">Counted quantity</label>
            <input type="number" min="0" className={input} value={counted} onChange={(e) => setCounted(e.target.value)} />
          </div>
        </div>
        <button onClick={submit} disabled={busy || !picked || counted === ''} className="mt-3 rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy ? 'Submitting…' : 'Submit Count'}</button>

        {result && (
          <div className="mt-3 rounded-md border border-gray-200 dark:border-gray-800 p-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Expected (system)</span><span>{result.expectedQuantity}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Counted (physical)</span><span>{result.countedQuantity}</span></div>
            <div className={`flex justify-between font-medium ${result.variance === 0 ? 'text-green-600' : 'text-orange-600'}`}><span>Variance</span><span>{result.variance > 0 ? '+' : ''}{result.variance}</span></div>
            {result.variance !== 0 && <p className="mt-2 text-xs text-orange-600">⚠ Variance detected — send to Stock Adjustment (Module 11) to correct. Stock is unchanged until then.</p>}
          </div>
        )}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Recent counts</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Medicine</th><th className="px-3 py-2 text-right">Expected</th><th className="px-3 py-2 text-right">Counted</th><th className="px-3 py-2 text-right">Variance</th><th className="px-3 py-2">When</th></tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {(listQ.data?.length ?? 0) === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">No reconciliation counts yet.</td></tr>}
            {listQ.data?.map((r) => (
              <tr key={r.id}><td className="px-3 py-2">{r.name}</td><td className="px-3 py-2 text-right">{r.expectedQuantity}</td><td className="px-3 py-2 text-right">{r.countedQuantity}</td><td className={`px-3 py-2 text-right font-medium ${r.variance === 0 ? 'text-green-600' : 'text-orange-600'}`}>{r.variance > 0 ? '+' : ''}{r.variance}</td><td className="px-3 py-2 text-gray-500">{new Date(r.countedAt).toLocaleDateString()}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
