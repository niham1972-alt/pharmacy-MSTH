import { useMemo, useState } from 'react';
import { useGrnList } from '../hooks/purchaseReturns.hooks';

/** Pick the originating GRN (Module 3). No server search param, so the list is
 *  fetched once and filtered client-side by GRN number / supplier. */
export function GrnLookupForm({ onSelect }: { onSelect: (grnId: string, grnNumber: string) => void }) {
  const { data, isLoading, isError, refetch } = useGrnList();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = data ?? [];
    if (!term) return rows.slice(0, 25);
    return rows.filter((g) => g.grnNumber.toLowerCase().includes(term) || (g.supplierName ?? '').toLowerCase().includes(term)).slice(0, 25);
  }, [data, q]);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Originating goods receipt (GRN)</label>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search GRN number or supplier…" className="mb-2 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm" autoFocus />
      {isLoading && <p className="text-sm text-gray-400">Loading GRNs…</p>}
      {isError && <p className="text-sm text-red-600">Couldn't load GRNs. <button onClick={() => refetch()} className="underline">Retry</button></p>}
      {data && (
        <div className="max-h-64 overflow-y-auto rounded-md border border-gray-100 dark:border-gray-800">
          {filtered.length === 0 && <p className="px-3 py-4 text-center text-sm text-gray-500">No matching GRNs.</p>}
          {filtered.map((g) => (
            <button key={g.id} onClick={() => onSelect(g.id, g.grnNumber)} className="flex w-full items-center justify-between border-b border-gray-50 px-3 py-2 text-left text-sm last:border-0 hover:bg-gray-50 dark:border-gray-900 dark:hover:bg-gray-800">
              <span className="font-mono text-brand-600">{g.grnNumber}</span>
              <span className="text-xs text-gray-500">{g.supplierName ?? ''}{g.receivedDate ? ` · ${new Date(g.receivedDate).toLocaleDateString()}` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
