import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ApiClientError } from '../../shared/api/client';
import { auditLogsApi, downloadCsv } from '../../features/audit-logs/api/audit-logs.api';
import { AuditLogsTable } from '../../features/audit-logs/components/AuditLogsTable';

const PRESETS: Record<string, number> = { Today: 0, '7 days': 7, '30 days': 30, '90 days': 90 };

export function AuditLogsListPage() {
  const [preset, setPreset] = useState('7 days');
  const [action, setAction] = useState('');
  const [severity, setSeverity] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateFrom = (() => { const d = new Date(); d.setDate(d.getDate() - PRESETS[preset]); d.setHours(0, 0, 0, 0); return d.toISOString(); })();
  const filters = { dateFrom, actionType: action || undefined, severity: severity || undefined, search: search || undefined };

  const registry = useQuery({ queryKey: ['audit-registry'], queryFn: async () => (await auditLogsApi.actionRegistry()).data });
  const integrity = useQuery({ queryKey: ['audit-integrity'], queryFn: async () => (await auditLogsApi.integrityStatus()).data });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit-logs', filters, page],
    queryFn: async () => { const res = await auditLogsApi.list({ ...filters, page, limit: 30 }); return { data: res.data, meta: res.meta as { page: number; total: number; totalPages: number } }; },
    placeholderData: keepPreviousData,
  });
  const rows = data?.data ?? [];
  const meta = data?.meta;
  const input = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';

  const exportCsv = async () => {
    setBusy(true); setError(null);
    try { const r = (await auditLogsApi.exportCsv(filters)).data; downloadCsv(r.csv, r.filename); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : 'Export failed.'); }
    finally { setBusy(false); }
  };
  const runIntegrity = async () => { setBusy(true); try { await auditLogsApi.runIntegrityCheck(); integrity.refetch(); } finally { setBusy(false); } };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Audit Log</h1>
        <div className="flex items-center gap-2">
          <Link to="/audit-logs/sensitive" className="rounded-md border border-orange-300 dark:border-orange-800 px-3 py-1.5 text-sm text-orange-700 dark:text-orange-400">Sensitive Events</Link>
          <button onClick={exportCsv} disabled={busy} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm disabled:opacity-50">Export CSV</button>
        </div>
      </div>

      {integrity.data && (
        <div className="mb-3 flex items-center gap-3 rounded-md border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm">
          <span className="text-gray-500">Tamper-evidence:</span>
          {integrity.data.lastCheck ? (
            integrity.data.lastCheck.chainIntact
              ? <span className="text-green-600">✓ Hash-chain intact ({integrity.data.lastCheck.recordsChecked} records, {new Date(integrity.data.lastCheck.checkedAt).toLocaleDateString()})</span>
              : <span className="text-red-600 font-medium">⚠ CHAIN BREAK detected at {integrity.data.lastCheck.brokenAtRecordId?.slice(0, 8)} — possible tampering</span>
          ) : <span className="text-gray-400">not yet checked ({integrity.data.totalRecords} records)</span>}
          <button onClick={runIntegrity} disabled={busy} className="ml-auto text-xs underline text-brand-600">Run check</button>
        </div>
      )}

      {error && <div role="alert" className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <div className="mb-4 flex flex-wrap gap-2">
        <select value={preset} onChange={(e) => { setPreset(e.target.value); setPage(1); }} className={input}>{Object.keys(PRESETS).map((p) => <option key={p} value={p}>{p}</option>)}</select>
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className={input}><option value="">Any action</option>{registry.data?.map((a) => <option key={a.actionKey} value={a.actionKey}>{a.label}</option>)}</select>
        <select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} className={input}><option value="">Any severity</option><option value="ROUTINE">Routine</option><option value="SENSITIVE">Sensitive</option><option value="CRITICAL">Critical</option></select>
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search action / id / user…" className={`w-56 ${input}`} />
      </div>

      {isLoading && <div className="animate-pulse text-gray-400">Loading…</div>}
      {isError && <div className="text-red-600">Couldn't load. <button onClick={() => refetch()} className="underline">Retry</button></div>}
      {data && <AuditLogsTable rows={rows} />}

      {meta && meta.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>{meta.total} events · page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 disabled:opacity-40">Prev</button>
            <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
