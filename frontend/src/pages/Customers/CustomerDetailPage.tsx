import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { ApiClientError } from '../../shared/api/client';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { customersApi } from '../../features/customers/api/customers.api';

const WRITE = ['super_admin', 'admin', 'pharmacist'];
const HEALTH = ['super_admin', 'admin', 'pharmacist'];
const SPEND = ['super_admin', 'admin', 'accountant', 'auditor'];

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = WRITE.includes(user?.role ?? '');
  const canHealth = HEALTH.includes(user?.role ?? '');
  const canSpend = SPEND.includes(user?.role ?? '');

  // Health tab is only present for authorised roles (absence, not disabled).
  const TABS = ['Overview', 'Purchase History', 'Prescriptions', ...(canHealth ? ['Health Info'] : []), 'Notes'];
  const [tab, setTab] = useState('Overview');
  const [noteText, setNoteText] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const { data: c, isLoading, isError, refetch } = useQuery({ queryKey: ['customers', 'detail', id], queryFn: async () => (await customersApi.detail(id!)).data, enabled: !!id });
  const historyQ = useQuery({ queryKey: ['customers', 'history', id], queryFn: async () => (await customersApi.purchaseHistory(id!)).data, enabled: !!id && tab === 'Purchase History' });
  const rxQ = useQuery({ queryKey: ['customers', 'rx', id], queryFn: async () => (await customersApi.prescriptions(id!)).data, enabled: !!id && tab === 'Prescriptions' && canWrite });
  // The health fetch itself is gated — never requested for a role without access.
  const healthQ = useQuery({ queryKey: ['customers', 'health', id], queryFn: async () => (await customersApi.healthProfile(id!)).data, enabled: !!id && tab === 'Health Info' && canHealth });

  if (isLoading) return <div className="animate-pulse text-gray-400">Loading customer…</div>;
  if (isError || !c) return <div className="text-red-600">Couldn't load customer. <button onClick={() => refetch()} className="underline">Retry</button></div>;

  const archive = async () => { if (!confirm('Archive this customer?')) return; try { await customersApi.archive(c.id); refetch(); } catch (e) { setErr(e instanceof ApiClientError ? e.message : 'Failed'); } };
  const addNote = async () => { if (!noteText.trim()) return; try { await customersApi.addNote(c.id, noteText.trim()); setNoteText(''); refetch(); } catch (e) { setErr(e instanceof ApiClientError ? e.message : 'Failed'); } };
  const row = (label: string, value: React.ReactNode) => <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 py-1.5 text-sm"><span className="text-gray-500">{label}</span><span className="text-gray-900 dark:text-gray-100">{value}</span></div>;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-2 text-sm text-gray-500"><Link to="/customers" className="underline">Customers</Link> / {c.name}</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{c.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{c.phone}{c.email && ` · ${c.email}`}{!c.isActive && <span className="ml-2 rounded bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 text-xs">Archived</span>}</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Link to={`/customers/${c.id}/edit`} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Edit</Link>
            {c.isActive && ['super_admin', 'admin'].includes(user?.role ?? '') && <button onClick={archive} className="rounded-md border border-orange-300 dark:border-orange-800 px-3 py-1.5 text-sm text-orange-700 dark:text-orange-400">Archive</button>}
          </div>
        )}
      </div>
      {err && <div role="alert" className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{err}</div>}

      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm ${tab === t ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400 font-medium' : 'text-gray-500'} ${t === 'Health Info' ? 'text-rose-600 dark:text-rose-400' : ''}`}>{t === 'Health Info' ? '🔒 Health Info' : t}</button>)}
      </div>

      {tab === 'Overview' && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          {row('Date of birth', c.dateOfBirth ? new Date(c.dateOfBirth).toLocaleDateString() : '—')}
          {row('Gender', c.gender ?? '—')}
          {row('National / Patient ID', c.nationalIdOrPatientId ?? '—')}
          {row('Address', [c.addressLine1, c.addressLine2, c.city].filter(Boolean).join(', ') || '—')}
          {row('Emergency contact', c.emergencyContactName ? `${c.emergencyContactName} · ${c.emergencyContactPhone ?? ''}` : '—')}
          {row('Registered', new Date(c.registeredAt).toLocaleDateString())}
          {row('Consent — health data', c.consentHealthDataStorage ? 'Yes' : 'No')}
          {row('Consent — marketing', c.consentMarketingContact ? 'Yes' : 'No')}
          {canSpend && row('Lifetime spend', c.lifetimeSpend != null ? formatCurrency(c.lifetimeSpend) : '—')}
          {c.tags.length > 0 && row('Tags', <span>{c.tags.map((t) => <span key={t.id} className="ml-1 inline-block rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: (t.color ?? '#e5e7eb') + '33', color: t.color ?? '#374151' }}>{t.name}</span>)}</span>)}
        </div>
      )}

      {tab === 'Purchase History' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Sale</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Items</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {historyQ.isLoading && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Loading…</td></tr>}
              {historyQ.data?.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">No purchase history yet for this customer.</td></tr>}
              {historyQ.data?.map((s) => <tr key={s.id}><td className="px-3 py-2"><Link to={`/sales/${s.id}`} className="underline">{s.saleNumber}</Link></td><td className="px-3 py-2 text-gray-500">{new Date(s.saleDate).toLocaleDateString()}</td><td className="px-3 py-2">{s.itemCount}</td><td className="px-3 py-2 text-right">{formatCurrency(s.grandTotal)}</td><td className="px-3 py-2">{s.status}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Prescriptions' && canWrite && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {rxQ.isLoading && <p className="px-4 py-6 text-center text-gray-400">Loading…</p>}
          {rxQ.data?.length === 0 && <p className="px-4 py-6 text-center text-gray-500">No prescriptions on file.</p>}
          {rxQ.data?.map((p) => (
            <div key={p.id} className="px-4 py-2 text-sm">
              <div className="flex justify-between"><span className="font-medium">{p.referenceNumber ?? 'Prescription'}{p.fileUrl && <a href={p.fileUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs text-brand-600 underline">image</a>}</span><span className="text-gray-500">{new Date(p.uploadedAt).toLocaleDateString()}</span></div>
              <p className="text-xs text-gray-400">{p.prescribingDoctor && `Dr. ${p.prescribingDoctor} · `}{p.notes}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'Health Info' && canHealth && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20 p-4">
          <p className="mb-3 text-xs text-rose-700 dark:text-rose-400">🔒 Sensitive health information — access is audit-logged.</p>
          {healthQ.isLoading && <p className="text-gray-400">Loading…</p>}
          {healthQ.data && (
            <div className="space-y-3 text-sm">
              <div><p className="text-xs text-gray-500">Allergies</p><p>{healthQ.data.allergyTags.length ? healthQ.data.allergyTags.map((a) => <span key={a} className="mr-1 inline-block rounded bg-red-100 dark:bg-red-950 px-2 py-0.5 text-xs text-red-700 dark:text-red-300">{a}</span>) : '—'}{healthQ.data.allergiesFreeText && <span className="block text-gray-500">{healthQ.data.allergiesFreeText}</span>}</p></div>
              <div><p className="text-xs text-gray-500">Chronic conditions</p><p>{healthQ.data.chronicConditionTags.length ? healthQ.data.chronicConditionTags.map((a) => <span key={a} className="mr-1 inline-block rounded bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">{a}</span>) : '—'}{healthQ.data.chronicConditionsFreeText && <span className="block text-gray-500">{healthQ.data.chronicConditionsFreeText}</span>}</p></div>
              {canWrite && <Link to={`/customers/${c.id}/edit?health=1`} className="inline-block text-xs text-brand-600 underline">Edit health info</Link>}
            </div>
          )}
        </div>
      )}

      {tab === 'Notes' && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          {canWrite && (
            <div className="mb-3 flex gap-2">
              <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note…" className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm" />
              <button onClick={addNote} disabled={!noteText.trim()} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Add</button>
            </div>
          )}
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {c.notes.length === 0 && <p className="py-4 text-center text-sm text-gray-500">No notes yet.</p>}
            {c.notes.map((n) => <div key={n.id} className="py-2 text-sm"><p>{n.note}</p><p className="text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}</p></div>)}
          </div>
        </div>
      )}
    </div>
  );
}
