import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClientError } from '../../shared/api/client';
import { LookupKind } from '../../features/medicines/api/medicines.api';
import { useLookupMutations, useLookupQuery } from '../../features/medicines/hooks/useLookups';

const TABS: Array<[LookupKind, string]> = [
  ['categories', 'Categories'],
  ['manufacturers', 'Manufacturers'],
  ['dosageForms', 'Dosage Forms'],
  ['units', 'Units'],
];

export function LookupsManagementPage() {
  const [kind, setKind] = useState<LookupKind>('categories');
  const { data, isLoading, refetch } = useLookupQuery(kind);
  const { create, remove } = useLookupMutations(kind);
  const [name, setName] = useState('');
  const [extra, setExtra] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onAdd = async () => {
    if (!name.trim()) return;
    setError(null);
    const body: Record<string, unknown> = { name: name.trim() };
    if (kind === 'manufacturers' && extra.trim()) body.country = extra.trim();
    if (kind === 'units' && extra.trim()) body.symbol = extra.trim();
    try {
      await create.mutateAsync(body);
      setName('');
      setExtra('');
      refetch();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to create.');
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm('Delete this entry? Blocked if any medicine uses it.')) return;
    setError(null);
    try {
      await remove.mutateAsync(id);
      refetch();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to delete.');
    }
  };

  const inputCls = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 text-sm text-gray-500"><Link to="/medicines" className="underline">Medicines</Link> / Manage Lookups</div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Manage Lookups</h1>

      <div role="tablist" className="mb-4 flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setError(null); }} className={`px-3 py-2 text-sm ${kind === k ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400 font-medium' : 'text-gray-500'}`}>{label}</button>
        ))}
      </div>

      {error && <div role="alert" className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-xs text-gray-500">Name</span>
          <input className={`${inputCls} block`} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onAdd()} />
        </label>
        {kind === 'manufacturers' && (
          <label className="block"><span className="text-xs text-gray-500">Country</span><input className={`${inputCls} block`} value={extra} onChange={(e) => setExtra(e.target.value)} /></label>
        )}
        {kind === 'units' && (
          <label className="block"><span className="text-xs text-gray-500">Symbol</span><input className={`${inputCls} block`} value={extra} onChange={(e) => setExtra(e.target.value)} /></label>
        )}
        <button onClick={onAdd} disabled={create.isPending} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">Add</button>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
        {isLoading && <p className="px-3 py-3 text-sm text-gray-500">Loading…</p>}
        {data && data.length === 0 && <p className="px-3 py-3 text-sm text-gray-500">No entries yet.</p>}
        {data?.map((item) => (
          <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="text-gray-900 dark:text-gray-100">
              {item.name}
              {item.country && <span className="text-gray-400"> · {item.country}</span>}
              {item.symbol && <span className="text-gray-400"> · {item.symbol}</span>}
            </span>
            <button onClick={() => onDelete(item.id)} className="text-xs text-red-600 dark:text-red-400 underline">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
