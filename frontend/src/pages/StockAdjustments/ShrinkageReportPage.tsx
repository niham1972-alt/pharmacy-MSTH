import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { stockAdjustmentsApi } from '../../features/stock-adjustments/api/stock-adjustments.api';
import { REASON_LABELS, AdjustmentReasonCode, ShrinkageBucket } from '../../features/stock-adjustments/types/stock-adjustment.types';

function BarTable({ title, rows, labelFn }: { title: string; rows: ShrinkageBucket[]; labelFn?: (k: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-gray-400">No data.</p>}
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.id}>
            <div className="flex justify-between text-xs"><span>{labelFn ? labelFn(r.key) : r.key}</span><span className="text-gray-500">{r.quantity} units · {formatCurrency(r.value)} · {r.count}×</span></div>
            <div className="mt-0.5 h-2 rounded bg-gray-100 dark:bg-gray-800"><div className="h-2 rounded bg-red-500" style={{ width: `${(r.value / max) * 100}%` }} /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ShrinkageReportPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['shrinkage', dateFrom, dateTo], queryFn: async () => (await stockAdjustmentsApi.shrinkage({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined })).data });
  const input = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm';

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-gray-900 dark:text-gray-100">Shrinkage / Loss Report</h1>
      <p className="mb-4 text-sm text-gray-500">Aggregate negative (decrease) adjustments over a period — patterns worth a closer look.</p>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-gray-500">From<input type="date" className={`${input} block`} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
        <label className="text-xs text-gray-500">To<input type="date" className={`${input} block`} value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
      {data && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3"><p className="text-xs text-gray-500">Total units lost</p><p className="mt-1 text-2xl font-semibold text-red-600">{data.totalNegativeQuantity}</p></div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3"><p className="text-xs text-gray-500">Total value</p><p className="mt-1 text-2xl font-semibold text-red-600">{formatCurrency(data.totalValue)}</p></div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <BarTable title="By reason" rows={data.byReason} labelFn={(k) => REASON_LABELS[k as AdjustmentReasonCode] ?? k} />
            <BarTable title="By medicine" rows={data.byMedicine} />
            <BarTable title="By requester (fraud signal)" rows={data.byRequester} labelFn={(k) => k.slice(0, 8)} />
          </div>
        </>
      )}
    </div>
  );
}
