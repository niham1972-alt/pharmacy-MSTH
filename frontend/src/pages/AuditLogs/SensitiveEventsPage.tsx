import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ApiClientError } from '../../shared/api/client';
import { auditLogsApi, downloadCsv } from '../../features/audit-logs/api/audit-logs.api';
import { AuditLogsTable } from '../../features/audit-logs/components/AuditLogsTable';

const PRESETS: Record<string, number> = { '7 days': 7, '30 days': 30, '90 days': 90 };

export function SensitiveEventsPage() {
  const [preset, setPreset] = useState('30 days');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dateFrom = (() => { const d = new Date(); d.setDate(d.getDate() - PRESETS[preset]); d.setHours(0, 0, 0, 0); return d.toISOString(); })();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit-sensitive', preset, page],
    queryFn: async () => { const res = await auditLogsApi.sensitive({ dateFrom, page, limit: 30 }); return { data: res.data, meta: res.meta as { page: number; total: number; totalPages: number } }; },
    placeholderData: keepPreviousData,
  });
  const meta = data?.meta;
  const input = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';

  const controlledReport = async () => {
    setBusy(true); setError(null);
    try { const r = (await auditLogsApi.controlledSubstanceReport({ dateFrom })).data; downloadCsv(r.csv, r.filename); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : 'Report failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="mb-2 text-sm text-gray-500"><Link to="/audit-logs" className="underline">Audit Log</Link> / Sensitive Events</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Sensitive &amp; Critical Events</h1>
        <button onClick={controlledReport} disabled={busy} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm disabled:opacity-50">Controlled-Substance Report (CSV)</button>
      </div>
      <p className="mb-4 text-sm text-gray-500">Health-data access, controlled-substance dispensing, price overrides, and security/access changes — the events worth actively reviewing.</p>
      {error && <div role="alert" className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <div className="mb-4"><select value={preset} onChange={(e) => { setPreset(e.target.value); setPage(1); }} className={input}>{Object.keys(PRESETS).map((p) => <option key={p} value={p}>{p}</option>)}</select></div>

      {isLoading && <div className="animate-pulse text-gray-400">Loading…</div>}
      {isError && <div className="text-red-600">Couldn't load. <button onClick={() => refetch()} className="underline">Retry</button></div>}
      {data && <AuditLogsTable rows={data.data} sensitive />}

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
