import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClientError } from '../../../shared/api/client';
import { DateRangePicker } from './DateRangePicker';
import { ExportButton } from './ExportButton';
import { SaveReportConfigButton } from './SaveReportConfigButton';
import { TabularReportView } from './TabularReportView';
import { ProfitLossStatementView } from './ProfitLossStatementView';
import { useProfitLossReport, useTabularReport } from '../hooks/useReportData';
import { ReportCatalogEntry, ReportFilters } from '../types/reports.types';

const inputCls = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm';

/** The consistent shell every report renders in (spec §5): title, filters, export,
 *  save, and the table/statement body. Config-driven from the report catalog. */
export function ReportView({ entry, initialFilters }: { entry: ReportCatalogEntry; initialFilters?: ReportFilters }) {
  const [filters, setFilters] = useState<ReportFilters>(initialFilters ?? { dateRangeType: entry.needsRange ? 'rolling_this_month' : undefined, metric: entry.metricToggle ? 'qty' : undefined });
  const patch = (p: Partial<ReportFilters>) => setFilters((f) => ({ ...f, ...p }));

  const idKey = entry.needsIdParam;
  const idReady = !idKey || !!filters[idKey];
  const isStatement = entry.isStatement;

  const pnl = useProfitLossReport(filters, isStatement && idReady);
  const tabular = useTabularReport(entry.type, filters, !isStatement && idReady);
  const active = isStatement ? pnl : tabular;
  const errMsg = active.error instanceof ApiClientError ? active.error.message : active.isError ? 'Could not load this report.' : null;

  return (
    <div>
      <div className="mb-3">
        <Link to="/reports" className="text-sm text-brand-600 hover:underline">← All reports</Link>
        <h1 className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">{entry.title}</h1>
        <p className="text-sm text-gray-500">{entry.description}</p>
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
        <div className="flex flex-wrap items-end gap-2">
          {entry.needsRange && <DateRangePicker value={filters} onChange={patch} />}
          {entry.metricToggle && (
            <label className="text-sm"><span className="mb-1 block text-xs text-gray-500">Rank by</span>
              <select value={filters.metric ?? 'qty'} onChange={(e) => patch({ metric: e.target.value })} className={inputCls}><option value="qty">Quantity</option><option value="revenue">Revenue</option></select>
            </label>
          )}
          {idKey && (
            <label className="text-sm"><span className="mb-1 block text-xs text-gray-500">{idKey === 'batchId' ? 'Batch ID' : 'Customer ID'}</span>
              <input value={filters[idKey] ?? ''} onChange={(e) => patch({ [idKey]: e.target.value } as Partial<ReportFilters>)} placeholder={`Enter ${idKey}`} className={`${inputCls} w-64`} />
            </label>
          )}
        </div>
        <div className="flex items-end gap-2">
          <SaveReportConfigButton reportType={entry.type} filters={filters} />
          <ExportButton reportType={entry.type} filters={filters} />
        </div>
      </div>

      {errMsg && <div role="alert" className="mb-3 rounded-md bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">{errMsg}</div>}
      {!idReady && <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-800 p-8 text-center text-sm text-gray-400">Enter a {idKey} above to run this report.</div>}

      {idReady && (isStatement
        ? (active.isLoading ? <div className="py-10 text-center text-gray-400">Loading…</div> : pnl.data ? <ProfitLossStatementView pnl={pnl.data} /> : null)
        : <TabularReportView report={tabular.data} isLoading={tabular.isLoading} isError={tabular.isError} />)}
    </div>
  );
}
