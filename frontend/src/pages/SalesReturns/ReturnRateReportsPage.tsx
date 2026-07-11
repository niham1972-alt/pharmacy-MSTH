import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useReturnReports } from '../../features/sales-returns/hooks/salesReturns.hooks';
import { ReturnRateByMedicineChart, ReturnRateByReasonChart } from '../../features/sales-returns/components/ReturnRateCharts';

export function ReturnRateReportsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { byMedicine, byReason } = useReturnReports({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
  const input = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm';

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Return rate reports</h1>
        <Link to="/sales-returns" className="text-sm text-brand-600 hover:underline">← All returns</Link>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-gray-500">From<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`mt-0.5 block ${input}`} /></label>
        <label className="text-xs text-gray-500">To<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`mt-0.5 block ${input}`} /></label>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">By medicine <span className="font-normal text-gray-400">(returned ÷ sold)</span></h2>
          {byMedicine.isLoading ? <p className="animate-pulse text-gray-400">Loading…</p> : <ReturnRateByMedicineChart rows={byMedicine.data ?? []} />}
        </section>
        <section className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">By reason <span className="font-normal text-gray-400">(damaged/defective flagged red)</span></h2>
          {byReason.isLoading ? <p className="animate-pulse text-gray-400">Loading…</p> : <ReturnRateByReasonChart rows={byReason.data ?? []} />}
        </section>
      </div>
    </div>
  );
}
