import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiClientError } from '../../shared/api/client';
import { platformApi } from '../api/platform.api';

export function OnboardTenantPage() {
  const nav = useNavigate();
  const { data: plans } = useQuery({ queryKey: ['platform', 'plans'], queryFn: async () => (await platformApi.plans()).data });
  const [f, setF] = useState({ businessName: '', contactEmail: '', contactPhone: '', subscriptionPlanId: '', adminEmail: '', adminName: '', trialDays: '14' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const res = (await platformApi.onboard({
        businessName: f.businessName, contactEmail: f.contactEmail, contactPhone: f.contactPhone || undefined,
        subscriptionPlanId: f.subscriptionPlanId || undefined, adminEmail: f.adminEmail || undefined, adminName: f.adminName || undefined,
        trialDays: Number(f.trialDays) || 14,
      })).data;
      nav(`/platform-admin/tenants/${res.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Onboarding failed.');
    } finally { setBusy(false); }
  };

  const input = 'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800';
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Onboard Tenant</h1>
      {error && <div role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{error}</div>}
      <form onSubmit={submit} className="space-y-3 rounded-lg border border-gray-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <label className="block text-xs text-gray-500">Business name *<input required className={input} value={f.businessName} onChange={(e) => set('businessName', e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-gray-500">Contact email *<input required type="email" className={input} value={f.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} /></label>
          <label className="block text-xs text-gray-500">Contact phone<input className={input} value={f.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} /></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-gray-500">Subscription plan<select className={input} value={f.subscriptionPlanId} onChange={(e) => set('subscriptionPlanId', e.target.value)}><option value="">None (trial)</option>{plans?.filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="block text-xs text-gray-500">Trial days<input type="number" min="0" className={input} value={f.trialDays} onChange={(e) => set('trialDays', e.target.value)} /></label>
        </div>
        <div className="rounded-md border border-gray-200 p-3 dark:border-slate-800">
          <p className="mb-2 text-xs font-medium text-gray-500">First admin invite (optional — sends a Module 16 invite scoped to this new tenant)</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-gray-500">Admin email<input type="email" className={input} value={f.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} /></label>
            <label className="block text-xs text-gray-500">Admin name<input className={input} value={f.adminName} onChange={(e) => set('adminName', e.target.value)} /></label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => nav('/platform-admin/tenants')} className="rounded-md border border-gray-300 px-4 py-2 text-sm dark:border-slate-700">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{busy ? 'Onboarding…' : 'Onboard tenant'}</button>
        </div>
      </form>
    </div>
  );
}
