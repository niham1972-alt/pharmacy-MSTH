import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '../../shared/api/client';
import { platformApi } from '../api/platform.api';

export function FeatureFlagsPage() {
  const qc = useQueryClient();
  const { data: flags, isLoading } = useQuery({ queryKey: ['platform', 'flags'], queryFn: async () => (await platformApi.flags()).data });
  const { data: tenants } = useQuery({ queryKey: ['platform', 'tenants', 'all'], queryFn: async () => (await platformApi.tenants({ limit: '200' })).data });
  const [form, setForm] = useState({ key: '', description: '' });
  const [error, setError] = useState<string | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['platform', 'flags'] });
  const create = useMutation({ mutationFn: () => platformApi.createFlag({ key: form.key, description: form.description || undefined }), onSuccess: () => { invalidate(); setForm({ key: '', description: '' }); setError(null); }, onError: (e) => setError(e instanceof ApiClientError ? e.message : 'Failed') });
  const update = useMutation({ mutationFn: (v: { id: string; body: unknown }) => platformApi.updateFlag(v.id, v.body), onSuccess: invalidate, onError: (e) => setError(e instanceof ApiClientError ? e.message : 'Failed') });
  const remove = useMutation({ mutationFn: (id: string) => platformApi.removeFlag(id), onSuccess: invalidate });
  const nameOf = new Map((tenants ?? []).map((t) => [t.id, t.businessName]));
  const input = 'w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800';

  const toggleTenant = (id: string, current: string[], pharmacyId: string) => {
    const next = current.includes(pharmacyId) ? current.filter((x) => x !== pharmacyId) : [...current, pharmacyId];
    update.mutate({ id, body: { enabledForPharmacyIds: next } });
  };

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-gray-900 dark:text-gray-100">Feature Flags</h1>
      <p className="mb-4 text-sm text-gray-500">Toggle globally, or roll out to a specific allow-list of tenants for staged releases.</p>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="mb-4 flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <input required placeholder="flag_key (e.g. advanced_reports_v2)" className={`${input} w-64`} value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
        <input placeholder="Description" className={`${input} flex-1`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button type="submit" disabled={create.isPending} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Add flag</button>
      </form>

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
        {flags?.length === 0 && <p className="text-sm text-gray-400">No feature flags yet.</p>}
        {flags?.map((f) => (
          <div key={f.id} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm font-medium">{f.key}</span>
                {f.description && <span className="ml-2 text-xs text-gray-400">{f.description}</span>}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={f.isGloballyEnabled} onChange={(e) => update.mutate({ id: f.id, body: { isGloballyEnabled: e.target.checked } })} /> Global</label>
                <button onClick={() => { if (window.confirm('Delete this flag?')) remove.mutate(f.id); }} className="text-xs text-red-500 hover:underline">Delete</button>
              </div>
            </div>
            {!f.isGloballyEnabled && (
              <div className="mt-2">
                <p className="mb-1 text-xs text-gray-500">Enabled for {f.enabledForPharmacyIds.length} tenant(s):</p>
                <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                  {(tenants ?? []).map((t) => {
                    const on = f.enabledForPharmacyIds.includes(t.id);
                    return <button key={t.id} onClick={() => toggleTenant(f.id, f.enabledForPharmacyIds, t.id)} className={`rounded-full px-2 py-0.5 text-xs ${on ? 'bg-indigo-600 text-white' : 'border border-gray-300 text-gray-500 dark:border-slate-700'}`}>{on ? '✓ ' : ''}{nameOf.get(t.id) ?? t.businessName}</button>;
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
