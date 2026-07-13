import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ApiClientError } from '../../shared/api/client';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { platformApi } from '../api/platform.api';
import { TenantStatusBadge } from '../components/TenantStatusBadge';
import { ImpersonateModal } from '../components/ImpersonateModal';

type Tab = 'overview' | 'billing' | 'usage' | 'users' | 'impersonation' | 'notes';
const TABS: [Tab, string][] = [['overview', 'Overview'], ['billing', 'Subscription & Billing'], ['usage', 'Usage'], ['users', 'Users'], ['impersonation', 'Impersonation History'], ['notes', 'Notes']];

export function TenantDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [showImpersonate, setShowImpersonate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const { data: t, isLoading, isError } = useQuery({ queryKey: ['platform', 'tenant', id], queryFn: async () => (await platformApi.tenant(id)).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['platform', 'tenant', id] }); qc.invalidateQueries({ queryKey: ['platform', 'tenants'] }); };

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setBanner(null);
    try { await fn(); refresh(); setBanner(ok); }
    catch (e) { setBanner(e instanceof ApiClientError ? e.message : 'Action failed.'); }
    finally { setBusy(false); }
  };

  if (isLoading) return <p className="text-sm text-gray-500">Loading tenant…</p>;
  if (isError || !t) return <p className="text-sm text-red-600">Couldn't load tenant.</p>;

  const canImpersonate = t.status !== 'ARCHIVED';

  return (
    <div>
      <div className="mb-1 text-sm text-gray-500"><Link to="/platform-admin/tenants" className="hover:underline">Tenants</Link> / {t.businessName}</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t.businessName}</h1>
          <TenantStatusBadge status={t.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {canImpersonate && <button onClick={() => setShowImpersonate(true)} className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold text-black hover:bg-amber-400">👁 Impersonate</button>}
          {['ACTIVE', 'TRIAL', 'PAST_DUE'].includes(t.status) && (
            <button disabled={busy} onClick={() => { const r = window.prompt('Reason for suspension (billing, etc.):'); if (r !== null) void act(() => platformApi.suspend(id, r), 'Tenant suspended.'); }} className="rounded-md border border-orange-300 px-3 py-1.5 text-sm text-orange-700 dark:border-orange-800">Suspend</button>
          )}
          {t.status === 'SUSPENDED' && <button disabled={busy} onClick={() => void act(() => platformApi.reactivate(id), 'Tenant reactivated.')} className="rounded-md border border-green-300 px-3 py-1.5 text-sm text-green-700 dark:border-green-800">Reactivate</button>}
          {t.status !== 'ARCHIVED' && (
            <button disabled={busy} onClick={() => { if (!window.confirm('Archive this tenant? Access is revoked (data retained). This is a deliberate, near-permanent action.')) return; const r = window.prompt('Reason for archival (contract end, etc.):'); if (r !== null) void act(() => platformApi.archive(id, r), 'Tenant archived.'); }} className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-800">Archive</button>
          )}
        </div>
      </div>

      {banner && <div className="mb-3 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">{banner}</div>}
      {!t.hasActiveAdmin && <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">⚠ This tenant has <strong>no active admin user</strong> — they may be locked out. Consider reaching out.</div>}

      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200 dark:border-slate-800">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-sm ${tab === k ? 'border-b-2 border-indigo-600 font-medium text-indigo-700 dark:text-indigo-400' : 'text-gray-500'}`}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab t={t} onSaved={refresh} />}
      {tab === 'billing' && <BillingTab t={t} onChanged={refresh} />}
      {tab === 'usage' && <UsageTab id={id} />}
      {tab === 'users' && <UsersTab id={id} />}
      {tab === 'impersonation' && <ImpersonationTab targetPharmacyId={id} />}
      {tab === 'notes' && <NotesTab t={t} onSaved={refresh} />}

      {showImpersonate && <ImpersonateModal tenantId={id} pharmacyName={t.businessName} onClose={() => setShowImpersonate(false)} />}
    </div>
  );
}

const card = 'rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900';
const input = 'w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800';

function OverviewTab({ t, onSaved }: { t: import('../api/platform.api').TenantDetail; onSaved: () => void }) {
  const [businessName, setBusinessName] = useState(t.businessName);
  const [contactEmail, setContactEmail] = useState(t.contactEmail);
  const [contactPhone, setContactPhone] = useState(t.contactPhone ?? '');
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { await platformApi.updateTenant(t.id, { businessName, contactEmail, contactPhone }); onSaved(); } finally { setSaving(false); } };
  return (
    <div className={`${card} max-w-xl space-y-3`}>
      <label className="block text-xs text-gray-500">Business name<input className={input} value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></label>
      <label className="block text-xs text-gray-500">Contact email<input className={input} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></label>
      <label className="block text-xs text-gray-500">Contact phone<input className={input} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></label>
      <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-300">
        <div>Created: {new Date(t.createdAt).toLocaleDateString()}</div>
        <div>Impersonations: {t.impersonationCount}</div>
      </div>
      <button onClick={() => void save()} disabled={saving} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
    </div>
  );
}

function BillingTab({ t, onChanged }: { t: import('../api/platform.api').TenantDetail; onChanged: () => void }) {
  const { data: plans } = useQuery({ queryKey: ['platform', 'plans'], queryFn: async () => (await platformApi.plans()).data });
  const [planId, setPlanId] = useState(t.subscriptionPlanId ?? '');
  const [saving, setSaving] = useState(false);
  const change = async () => { if (!planId) return; setSaving(true); try { await platformApi.changePlan(t.id, planId); onChanged(); } finally { setSaving(false); } };
  return (
    <div className={`${card} max-w-xl space-y-3`}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-xs text-gray-500">Current plan</p><p className="font-medium">{t.plan ? `${t.plan.name} · ${formatCurrency(t.plan.priceAmount)}/${t.plan.billingInterval.toLowerCase()}` : 'No plan'}</p></div>
        <div><p className="text-xs text-gray-500">Billing status</p><TenantStatusBadge status={t.billingStatus} /></div>
        <div><p className="text-xs text-gray-500">Trial ends</p><p>{t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString() : '—'}</p></div>
        <div><p className="text-xs text-gray-500">Next renewal</p><p>{t.nextRenewalDate ? new Date(t.nextRenewalDate).toLocaleDateString() : '—'}</p></div>
      </div>
      <div className="border-t border-gray-100 pt-3 dark:border-slate-800">
        <p className="mb-1 text-xs text-gray-500">Change plan (active plans only)</p>
        <div className="flex gap-2">
          <select className={input} value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">Select a plan…</option>
            {plans?.filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{p.name} · {formatCurrency(p.priceAmount)}/{p.billingInterval.toLowerCase()}</option>)}
          </select>
          <button onClick={() => void change()} disabled={saving || !planId || planId === t.subscriptionPlanId} className="shrink-0 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Change</button>
        </div>
      </div>
    </div>
  );
}

function UsageTab({ id }: { id: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['platform', 'usage', id], queryFn: async () => (await platformApi.tenantUsage(id)).data });
  if (isLoading) return <p className="text-sm text-gray-500">Loading usage…</p>;
  if (!data) return null;
  const cell = (label: string, value: string | number) => <div className={card}><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {cell('Users', data.userCount)}{cell('Branches', data.branchCount)}{cell('Medicines', data.medicineCount)}
      {cell('Transactions', data.transactionCount)}{cell('Txn volume', formatCurrency(data.transactionVolume))}
      {cell('Last activity', data.lastActivityAt ? new Date(data.lastActivityAt).toLocaleDateString() : '—')}
    </div>
  );
}

function UsersTab({ id }: { id: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['platform', 'tenant-users', id], queryFn: async () => (await platformApi.tenantUsers(id)).data });
  if (isLoading) return <p className="text-sm text-gray-500">Loading users…</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-800">
      <table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-slate-900/40"><tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Status</th></tr></thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
          {data?.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">No users yet.</td></tr>}
          {data?.map((u) => <tr key={u.id}><td className="px-3 py-2">{u.name}</td><td className="px-3 py-2 text-gray-500">{u.email}</td><td className="px-3 py-2">{u.role ?? '—'}</td><td className="px-3 py-2">{u.status}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function ImpersonationTab({ targetPharmacyId }: { targetPharmacyId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['platform', 'impersonation-history'], queryFn: async () => (await platformApi.impersonationHistory()).data });
  const rows = (data ?? []).filter((r) => r.targetPharmacyId === targetPharmacyId);
  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-800">
      <table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-slate-900/40"><tr><th className="px-3 py-2">Staff</th><th className="px-3 py-2">Target user</th><th className="px-3 py-2">Reason</th><th className="px-3 py-2">Started</th><th className="px-3 py-2">Ended</th></tr></thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
          {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No impersonation sessions on record for this tenant.</td></tr>}
          {rows.map((r) => <tr key={r.id}><td className="px-3 py-2">{r.platformStaffEmail}</td><td className="px-3 py-2 text-gray-500">{r.targetUserEmail ?? r.targetUserId.slice(0, 8)}</td><td className="px-3 py-2">{r.reason}</td><td className="px-3 py-2 text-gray-500">{new Date(r.startedAt).toLocaleString()}</td><td className="px-3 py-2 text-gray-500">{r.active ? <span className="text-green-600">active</span> : r.endedReason ?? '—'}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function NotesTab({ t, onSaved }: { t: import('../api/platform.api').TenantDetail; onSaved: () => void }) {
  const [notes, setNotes] = useState(t.notes ?? '');
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { await platformApi.updateTenant(t.id, { notes }); onSaved(); } finally { setSaving(false); } };
  return (
    <div className={`${card} max-w-2xl`}>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={8} placeholder="Internal notes about this tenant…" className={input} />
      <button onClick={() => void save()} disabled={saving} className="mt-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save notes'}</button>
    </div>
  );
}
