import { useState } from 'react';
import { ApiClientError } from '../../../shared/api/client';
import { salesReturnsApi } from '../api/sales-returns.api';

/** Find the original sale by its number (receipt) → hand its id up to the flow. */
export function SaleLookupForm({ onFound }: { onFound: (saleId: string, saleNumber: string) => void }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async () => {
    const q = value.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    try {
      const res = await salesReturnsApi.findSaleByNumber(q);
      const match = res.data.find((s) => s.saleNumber.toLowerCase() === q.toLowerCase()) ?? res.data[0];
      if (!match) { setError('No sale found with that number.'); return; }
      onFound(match.id, match.saleNumber);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Lookup failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Original sale number</label>
      <div className="flex gap-2">
        <input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && lookup()} placeholder="e.g. SL-2026-000144 (or scan receipt)" className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm" autoFocus />
        <button onClick={lookup} disabled={busy || !value.trim()} className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy ? 'Finding…' : 'Look up'}</button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
