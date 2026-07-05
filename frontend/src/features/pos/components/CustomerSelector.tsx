import { useEffect, useState } from 'react';
import { ApiClientError } from '../../../shared/api/client';
import { Customer, customersApi } from '../api/pos.api';

export function CustomerSelector({ customerName, onSelect }: { customerName: string | null; onSelect: (id: string | null, name: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(h);
  }, [term]);
  useEffect(() => {
    if (!open) return;
    customersApi.search(debounced).then((r) => setResults(r.data)).catch(() => setResults([]));
  }, [debounced, open]);

  const quickAdd = async () => {
    if (!addName.trim() || !addPhone.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await customersApi.create(addName.trim(), addPhone.trim());
      onSelect(res.data.id, res.data.name);
      setOpen(false);
      setAddName('');
      setAddPhone('');
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not add customer.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">
        <span aria-hidden>👤</span>
        <span className="font-medium">{customerName ?? 'Walk-in Customer'}</span>
        {customerName && <span onClick={(e) => { e.stopPropagation(); onSelect(null, null); }} className="ml-1 text-gray-400 hover:text-red-500" title="Clear">✕</span>}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-72 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 shadow-lg text-sm">
          <input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search name or phone…" className="mb-2 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1" />
          <ul className="max-h-40 overflow-auto">
            {results.map((c) => (
              <li key={c.id}>
                <button onClick={() => { onSelect(c.id, c.name); setOpen(false); }} className="block w-full rounded px-2 py-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700">
                  {c.name} {c.phone && <span className="text-gray-400">· {c.phone}</span>}
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="px-2 py-1 text-gray-400">No matches</li>}
          </ul>
          <div className="mt-2 border-t border-gray-200 dark:border-gray-700 pt-2">
            <p className="mb-1 text-xs font-medium text-gray-500">+ Quick add</p>
            <div className="flex gap-1">
              <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Name *" className="w-1/2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1" />
              <input value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="Phone *" className="w-1/2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1" />
            </div>
            <button onClick={quickAdd} disabled={busy || !addName.trim() || !addPhone.trim()} className="mt-1 w-full rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50">{busy ? 'Adding…' : 'Add & select'}</button>
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
