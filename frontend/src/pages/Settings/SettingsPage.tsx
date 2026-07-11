import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../shared/auth/AuthContext';
import { SettingHistoryRow, settingsApi } from '../../features/settings/api/settings.api';
import { SettingField } from '../../features/settings/components/SettingField';

const CATEGORY_ORDER = ['General', 'Dashboard', 'Medicines', 'Purchases', 'Sales', 'Returns', 'Inventory', 'Batches', 'Customers', 'Users', 'Audit'];

export function SettingsPage() {
  const { user } = useAuth();
  const [activeCat, setActiveCat] = useState('General');
  const [search, setSearch] = useState('');
  const [historyKey, setHistoryKey] = useState<string | null>(null);

  const isAdmin = ['super_admin', 'admin'].includes(user?.role ?? '');
  const isInvMgr = user?.role === 'inventory_manager';

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['settings', 'list'], queryFn: async () => (await settingsApi.list()).data });

  const categories = useMemo(() => {
    const cats = Object.keys(data ?? {});
    return CATEGORY_ORDER.filter((c) => cats.includes(c)).concat(cats.filter((c) => !CATEGORY_ORDER.includes(c)));
  }, [data]);

  const searching = search.trim().length > 0;
  const visibleItems = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    if (searching) return Object.values(data).flat().filter((i) => i.label.toLowerCase().includes(term) || i.key.toLowerCase().includes(term) || (i.description ?? '').toLowerCase().includes(term));
    return data[activeCat] ?? [];
  }, [data, activeCat, search, searching]);

  const canWriteItem = (category: string) => isAdmin || (isInvMgr && category === 'Purchases');

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h1>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search all settings…" className="w-64 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm" />
      </div>

      {isLoading && <div className="animate-pulse text-gray-400">Loading settings…</div>}
      {isError && <div className="text-red-600">Couldn't load settings. <button onClick={() => refetch()} className="underline">Retry</button></div>}

      {data && (
        <div className="flex gap-6">
          {!searching && (
            <nav className="w-44 shrink-0 space-y-1">
              {categories.map((c) => (
                <button key={c} onClick={() => setActiveCat(c)} className={`block w-full rounded-md px-3 py-1.5 text-left text-sm ${activeCat === c ? 'bg-brand-50 dark:bg-brand-700/20 text-brand-700 dark:text-brand-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>{c}</button>
              ))}
            </nav>
          )}
          <div className="min-w-0 flex-1">
            {!isAdmin && !isInvMgr && <div className="mb-3 rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-500">Read-only view.</div>}
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 px-4">
              {visibleItems.length === 0 && <p className="py-8 text-center text-sm text-gray-500">No settings match your search.</p>}
              {visibleItems.map((item) => (
                <SettingField key={item.key} item={item} canWrite={canWriteItem(item.category)} onSaved={() => refetch()} onHistory={setHistoryKey} />
              ))}
            </div>
          </div>
        </div>
      )}

      {historyKey && <HistoryModal settingKey={historyKey} onClose={() => setHistoryKey(null)} />}
    </div>
  );
}

function HistoryModal({ settingKey, onClose }: { settingKey: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['settings', 'history', settingKey], queryFn: async () => (await settingsApi.history(settingKey)).data });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-lg bg-white dark:bg-gray-900 p-5 shadow-xl">
        <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">History — <code className="text-xs">{settingKey}</code></h2><button onClick={onClose} className="text-gray-400">✕</button></div>
        {isLoading && <p className="py-4 text-gray-400">Loading…</p>}
        {data?.length === 0 && <p className="py-4 text-center text-sm text-gray-500">No changes recorded — using the default.</p>}
        <div className="max-h-80 overflow-auto text-sm">
          {data?.map((h: SettingHistoryRow) => (
            <div key={h.id} className="border-b border-gray-100 dark:border-gray-800 py-2">
              <div className="flex justify-between"><span className="text-gray-500">{new Date(h.changedAt).toLocaleString()}</span>{h.branchId && <span className="text-xs text-indigo-500">branch</span>}</div>
              <div className="text-xs"><span className="text-red-500 line-through">{JSON.stringify(h.oldValue)}</span> → <span className="text-green-600">{JSON.stringify(h.newValue)}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
