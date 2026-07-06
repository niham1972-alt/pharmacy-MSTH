import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { ApiClientError } from '../../shared/api/client';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { suppliersApi } from '../../features/suppliers/api/suppliers.api';
import { ActiveBadge, LicenseBadge, TypeBadge } from '../../features/suppliers/components/SupplierStatusBadges';
import { AuditTrailTab } from '../../features/audit-logs/components/AuditTrailTab';

const MANAGE = ['super_admin', 'admin', 'inventory_manager'];
const PAYABLES = ['super_admin', 'admin', 'accountant', 'auditor'];
const PERF = ['super_admin', 'admin', 'inventory_manager', 'accountant', 'auditor'];
const TABS = ['Overview', 'Contacts', 'Documents', 'Pricing', 'Performance', 'Payables', 'Audit Trail'] as const;

export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { data: s, isLoading, isError, refetch } = useQuery({ queryKey: ['suppliers', 'detail', id], queryFn: async () => (await suppliersApi.detail(id!)).data, enabled: !!id });

  const canManage = MANAGE.includes(user?.role ?? '');
  const canDelete = ['super_admin', 'admin'].includes(user?.role ?? '');
  const canAudit = ['super_admin', 'admin', 'auditor'].includes(user?.role ?? '');
  const visibleTabs = TABS.filter((t) => (t === 'Payables' ? PAYABLES.includes(user?.role ?? '') : t === 'Performance' ? PERF.includes(user?.role ?? '') : t === 'Audit Trail' ? canAudit : true));

  const perfQ = useQuery({ queryKey: ['suppliers', 'perf', id], queryFn: async () => (await suppliersApi.performance(id!)).data, enabled: !!id && tab === 'Performance' && PERF.includes(user?.role ?? '') });
  const payQ = useQuery({ queryKey: ['suppliers', 'payables', id], queryFn: async () => (await suppliersApi.payables(id!)).data, enabled: !!id && tab === 'Payables' && PAYABLES.includes(user?.role ?? '') });

  if (isLoading) return <div className="animate-pulse text-gray-400">Loading supplier…</div>;
  if (isError || !s) return <div className="text-red-600">Couldn't load supplier. <button onClick={() => refetch()} className="underline">Retry</button></div>;

  const archive = async () => { if (!confirm('Archive this supplier? It will disappear from new-PO pickers but history stays intact.')) return; setBusy(true); setErr(null); try { await suppliersApi.archive(s.id); refetch(); } catch (e) { setErr(e instanceof ApiClientError ? e.message : 'Failed'); } finally { setBusy(false); } };
  const remove = async () => { if (!confirm('Permanently delete this supplier? Only possible if it has no purchase-order history.')) return; setBusy(true); setErr(null); try { await suppliersApi.remove(s.id); navigate('/suppliers'); } catch (e) { setErr(e instanceof ApiClientError ? e.message : 'Failed'); setBusy(false); } };

  const row = (label: string, value: React.ReactNode) => <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 py-1.5 text-sm"><span className="text-gray-500">{label}</span><span className="text-gray-900 dark:text-gray-100">{value}</span></div>;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-2 text-sm text-gray-500"><Link to="/suppliers" className="underline">Suppliers</Link> / {s.companyName}</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{s.companyName}</h1>
          <div className="mt-1 flex items-center gap-2"><TypeBadge type={s.supplierType} /><ActiveBadge isActive={s.isActive} /><LicenseBadge status={s.licenseStatus} daysToExpiry={s.licenseDaysToExpiry} /></div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Link to={`/suppliers/${s.id}/edit`} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Edit</Link>
            {s.isActive && <button onClick={archive} disabled={busy} className="rounded-md border border-orange-300 dark:border-orange-800 px-3 py-1.5 text-sm text-orange-700 dark:text-orange-400">Archive</button>}
            {canDelete && <button onClick={remove} disabled={busy} className="rounded-md border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm text-red-700 dark:text-red-400">Delete</button>}
          </div>
        )}
      </div>

      {err && <div role="alert" className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{err}</div>}
      {s.licenseStatus === 'expired' && <div className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">⚠ Drug license expired — renew and re-upload the document.</div>}
      {s.licenseStatus === 'expiring' && <div className="mb-3 rounded-md border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950 px-3 py-2 text-sm text-orange-700 dark:text-orange-300">⏳ Drug license expiring in {s.licenseDaysToExpiry} days.</div>}

      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800">
        {visibleTabs.map((t) => <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm ${tab === t ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400 font-medium' : 'text-gray-500'}`}>{t}</button>)}
      </div>

      {tab === 'Overview' && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          {row('Trading name', s.tradingName ?? '—')}
          {row('Payment terms', s.paymentTermsCode.replace('_', ' '))}
          {row('Currency', s.currency)}
          {row('Tax registration', s.taxRegistrationNumber ?? '—')}
          {row('Drug license', s.drugLicenseNumber ?? '—')}
          {row('License expiry', s.drugLicenseExpiry ? new Date(s.drugLicenseExpiry).toLocaleDateString() : '—')}
          {s.bankAccountDetails !== undefined && row('Bank details', s.bankAccountDetails ? <span className="text-xs">{JSON.stringify(s.bankAccountDetails)}</span> : '—')}
          {s.notes && row('Notes', s.notes)}
        </div>
      )}

      {tab === 'Contacts' && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {s.contacts.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-500">No contacts recorded.</p>}
          {s.contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <div><span className="font-medium">{c.name}</span>{c.isPrimary && <span className="ml-2 rounded bg-brand-50 dark:bg-brand-700/20 px-1.5 py-0.5 text-xs text-brand-700 dark:text-brand-400">Primary</span>}<span className="block text-xs text-gray-400">{c.designation}</span></div>
              <div className="text-right text-gray-500">{c.phone && <div>{c.phone}</div>}{c.email && <div className="text-xs">{c.email}</div>}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Documents' && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {s.documents.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-500">No compliance documents uploaded.</p>}
          {s.documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <div><span className="font-medium">{d.documentType.replace(/_/g, ' ')}</span><a href={d.fileUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs text-brand-600 underline">view</a></div>
              <div className="flex items-center gap-2 text-gray-500">{d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : 'no expiry'}<LicenseBadge status={d.status} daysToExpiry={d.daysToExpiry} /></div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Pricing' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Medicine</th><th className="px-3 py-2 text-right">Negotiated Cost</th><th className="px-3 py-2">Effective</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {s.pricing.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-500">No negotiated pricing set — using standard costs.</td></tr>}
              {s.pricing.map((p) => <tr key={p.id}><td className="px-3 py-2">{p.medicineName}</td><td className="px-3 py-2 text-right">{formatCurrency(p.negotiatedCost)}</td><td className="px-3 py-2 text-gray-500">{new Date(p.effectiveFrom).toLocaleDateString()}{p.effectiveTo ? ` – ${new Date(p.effectiveTo).toLocaleDateString()}` : ''}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Performance' && (
        <div>
          {perfQ.isLoading && <div className="animate-pulse text-gray-400">Loading…</div>}
          {perfQ.data && perfQ.data.totalPos === 0 && <div className="rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-8 text-center text-gray-500">No purchase history yet — performance appears once you order from this supplier.</div>}
          {perfQ.data && perfQ.data.totalPos > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ['Total POs', String(perfQ.data.totalPos)],
                ['Total Spend', formatCurrency(perfQ.data.totalSpend)],
                ['On-time %', perfQ.data.onTimeRate != null ? `${perfQ.data.onTimeRate}%` : '—'],
                ['Variance %', perfQ.data.varianceRate != null ? `${perfQ.data.varianceRate}%` : '—'],
                ['Variance incidents', String(perfQ.data.varianceIncidents)],
                ['Avg pay turnaround', perfQ.data.avgPaymentTurnaroundDays != null ? `${perfQ.data.avgPaymentTurnaroundDays}d` : '—'],
              ].map(([l, v]) => <div key={l} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3"><p className="text-xs text-gray-500">{l}</p><p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{v}</p></div>)}
            </div>
          )}
        </div>
      )}

      {tab === 'Payables' && (
        <div>
          {payQ.isLoading && <div className="animate-pulse text-gray-400">Loading…</div>}
          {payQ.data && (
            <>
              <div className="mb-3 grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3"><p className="text-xs text-gray-500">Outstanding</p><p className="mt-1 text-lg font-semibold text-orange-600">{formatCurrency(payQ.data.totalOutstanding)}</p></div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3"><p className="text-xs text-gray-500">Oldest unpaid</p><p className="mt-1 text-lg font-semibold">{payQ.data.oldestUnpaidAgeDays}d</p></div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3"><p className="text-xs text-gray-500">Overdue POs</p><p className="mt-1 text-lg font-semibold text-red-600">{payQ.data.overdueCount}</p></div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">PO</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2 text-right">Outstanding</th><th className="px-3 py-2">Due</th></tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {payQ.data.items.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Nothing outstanding. 🎉</td></tr>}
                    {payQ.data.items.map((i) => <tr key={i.purchaseOrderId}><td className="px-3 py-2"><Link to={`/purchases/${i.purchaseOrderId}`} className="underline">{i.poNumber}</Link></td><td className="px-3 py-2 text-right">{formatCurrency(i.grandTotal)}</td><td className="px-3 py-2 text-right">{formatCurrency(i.amountPaid)}</td><td className="px-3 py-2 text-right font-medium text-orange-600">{formatCurrency(i.outstanding)}</td><td className={`px-3 py-2 ${i.overdue ? 'text-red-600' : 'text-gray-500'}`}>{i.dueDate ? new Date(i.dueDate).toLocaleDateString() : '—'}{i.overdue && ' (overdue)'}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'Audit Trail' && <AuditTrailTab entityType="SUPPLIER" entityId={s.id} />}
    </div>
  );
}
