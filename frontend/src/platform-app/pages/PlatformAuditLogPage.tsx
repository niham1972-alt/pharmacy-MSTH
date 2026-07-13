import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { platformApi } from '../api/platform.api';

export function PlatformAuditLogPage() {
  const { data, isLoading } = useQuery({ queryKey: ['platform', 'audit'], queryFn: async () => (await platformApi.auditLog()).data });
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');

  const actions = useMemo(() => [...new Set((data ?? []).map((r) => r.action))].sort(), [data]);
  const rows = (data ?? []).filter((r) => (!action || r.action === action) && (!actor || r.platformStaffEmail.toLowerCase().includes(actor.toLowerCase())));
  const input = 'rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800';

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-gray-900 dark:text-gray-100">Platform Audit Log</h1>
      <p className="mb-4 text-sm text-gray-500">The vendor's own audit trail (tenant lifecycle, plan changes, impersonation, staff, flags) — separate from each pharmacy's Module 15 log.</p>
      <div className="mb-3 flex flex-wrap gap-2">
        <select value={action} onChange={(e) => setAction(e.target.value)} className={input}><option value="">All actions</option>{actions.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        <input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="Filter by staff email…" className={`${input} w-56`} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-800">
        <table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-slate-900/40"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Actor</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Entity</th><th className="px-3 py-2">Details</th></tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {isLoading && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Loading…</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No matching platform events.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 whitespace-nowrap text-gray-500">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">{r.platformStaffEmail}</td>
                <td className="px-3 py-2"><span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{r.action}</span></td>
                <td className="px-3 py-2 text-gray-500">{r.entityType}{r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ''}</td>
                <td className="px-3 py-2 text-xs text-gray-400">{r.metadata ? JSON.stringify(r.metadata) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
