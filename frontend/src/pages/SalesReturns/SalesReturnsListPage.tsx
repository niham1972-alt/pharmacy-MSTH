import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { useSalesReturnsList } from '../../features/sales-returns/hooks/salesReturns.hooks';
import { REFUND_LABELS, REASON_LABELS } from '../../features/sales-returns/types/sales-return.types';
import type { RefundMethod, ReturnReasonCode } from '../../features/sales-returns/types/sales-return.types';

export function SalesReturnsListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [refundMethod, setRefundMethod] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const { data, isLoading, isError, refetch } = useSalesReturnsList({ page, limit: 25, search: search || undefined, refundMethod: refundMethod || undefined, reasonCode: reasonCode || undefined });

  const sel = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm';
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Sales returns</h1>
        <div className="flex gap-2">
          <Link to="/sales-returns/reports" className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Return rate reports</Link>
          <Link to="/sales-returns/new" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Process return</Link>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Search return #…" className={sel} />
        <select value={refundMethod} onChange={(e) => { setPage(1); setRefundMethod(e.target.value); }} className={sel}><option value="">All refund methods</option>{(Object.keys(REFUND_LABELS) as RefundMethod[]).map((m) => <option key={m} value={m}>{REFUND_LABELS[m]}</option>)}</select>
        <select value={reasonCode} onChange={(e) => { setPage(1); setReasonCode(e.target.value); }} className={sel}><option value="">All reasons</option>{(Object.keys(REASON_LABELS) as ReturnReasonCode[]).map((r) => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}</select>
      </div>

      {isLoading && <p className="animate-pulse text-gray-400">Loading…</p>}
      {isError && <p className="text-red-600">Couldn't load returns. <button onClick={() => refetch()} className="underline">Retry</button></p>}
      {data && data.data.length === 0 && <div className="rounded-lg border border-gray-200 dark:border-gray-800 py-10 text-center text-sm text-gray-500">No returns processed yet.</div>}

      {data && data.data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-left text-xs uppercase text-gray-500">
              <tr><th className="px-3 py-2">Return #</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Items</th><th className="px-3 py-2">Refund</th><th className="px-3 py-2">Method</th></tr>
            </thead>
            <tbody>
              {data.data.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-3 py-2"><Link to={`/sales-returns/${r.id}`} className="font-mono text-brand-600 hover:underline">{r.returnNumber}</Link></td>
                  <td className="px-3 py-2 text-gray-500">{new Date(r.returnDate).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{r.itemCount}</td>
                  <td className="px-3 py-2 font-medium">{formatCurrency(r.totalRefundAmount)}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{REFUND_LABELS[r.refundMethod]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-gray-500">Page {data.meta.page} of {data.meta.totalPages} · {data.meta.total} total</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1 disabled:opacity-40">Prev</button>
            <button disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
