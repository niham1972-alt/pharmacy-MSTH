import { Link, useNavigate } from 'react-router-dom';
import { REPORT_CATALOG, REPORT_ROUTE, ReportType } from '../../features/reports/types/reports.types';
import { useSavedReportConfigurations } from '../../features/reports/hooks/useSavedReportConfigurations';

const titleOf = (t: ReportType) => REPORT_CATALOG.find((r) => r.type === t)?.title ?? t;

/** The user's saved report configurations — one click to re-run with saved filters
 *  (rolling periods recalculate server-side each run). Spec §5/§9. */
export function SavedReportsPage() {
  const { query, remove } = useSavedReportConfigurations();
  const navigate = useNavigate();

  const run = (reportType: ReportType, filters: Record<string, unknown>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters ?? {})) if (v) params.set(k, String(v));
    navigate(`${REPORT_ROUTE[reportType]}?${params.toString()}`);
  };

  return (
    <div>
      <div className="mb-4">
        <Link to="/reports" className="text-sm text-brand-600 hover:underline">← All reports</Link>
        <h1 className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">Saved Reports</h1>
      </div>

      {query.isLoading && <div className="py-10 text-center text-gray-400">Loading…</div>}
      {!query.isLoading && (query.data?.length ?? 0) === 0 && (
        <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-800 p-10 text-center text-sm text-gray-400">No saved reports yet. Save a configuration from any report page.</div>
      )}

      <div className="space-y-2">
        {query.data?.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">{c.name}</p>
              <p className="text-xs text-gray-500">{titleOf(c.reportType)} · {c.filters?.dateRangeType ?? 'custom'}</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => run(c.reportType, c.filters as Record<string, unknown>)} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Run</button>
              <button onClick={() => { if (confirm('Delete this saved report?')) remove.mutate(c.id); }} className="text-xs text-red-600 hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
