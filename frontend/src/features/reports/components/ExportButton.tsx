import { useReportExport } from '../hooks/useReportExport';
import { ReportFilters, ReportType } from '../types/reports.types';

/**
 * Shared CSV/PDF export trigger with async status handling (spec §9). Requests an
 * export job and surfaces "Generating…" / ready / failed, auto-downloading when ready.
 */
export function ExportButton({ reportType, filters }: { reportType: ReportType; filters: ReportFilters }) {
  const { start, isBusy, job, format, error } = useReportExport();
  const btn = 'rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm disabled:opacity-60';

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button type="button" disabled={isBusy} onClick={() => void start(reportType, 'CSV', filters)} className={btn}>Export CSV</button>
        <button type="button" disabled={isBusy} onClick={() => void start(reportType, 'PDF', filters)} className={btn}>Export PDF</button>
      </div>
      {isBusy && <span className="text-xs text-gray-500" role="status">Generating your {format} report…</span>}
      {job?.status === 'READY' && <span className="text-xs text-green-600">Downloaded {job.fileName}.</span>}
      {error && <span className="text-xs text-red-600" role="alert">Export failed: {error}</span>}
    </div>
  );
}
