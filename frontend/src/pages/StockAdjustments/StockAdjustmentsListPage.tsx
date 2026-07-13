import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { stockAdjustmentsApi } from '../../features/stock-adjustments/api/stock-adjustments.api';
import { AdjustmentStatusBadge } from '../../features/stock-adjustments/components/AdjustmentStatusBadge';
import { REASON_LABELS, AdjustmentReasonCode } from '../../features/stock-adjustments/types/stock-adjustment.types';

const CAN_CREATE = ['super_admin', 'admin', 'inventory_manager'];
const REASONS = Object.keys(REASON_LABELS) as AdjustmentReasonCode[];
const STATUSES = ['', 'AUTO_APPROVED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'];

export function StockAdjustmentsListPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [status, setStatus] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['adjustments', search, reasonCode, status],
    queryFn: async () => (await stockAdjustmentsApi.list({ search: search || undefined, reasonCode: reasonCode || undefined, status: status || undefined, limit: '100' })).data,
  });
  const input = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Stock Adjustments</h1>
        <div className="flex gap-2">
          <Link to="/stock-adjustments/shrinkage" className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Shrinkage Report</Link>
          {user?.role === 'admin' || user?.role === 'super_admin' ? <Link to="/stock-adjustments/pending" className="rounded-md border border-amber-300 dark:border-amber-800 px-3 py-1.5 text-sm text-amber-700 dark:text-amber-400">Pending Approvals</Link> : null}
          {CAN_CREATE.includes(user?.role ?? '') && (
            <>
              <Link to="/stock-adjustments/bulk" className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Bulk</Link>
              <Link to="/stock-adjustments/new" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">+ New Adjustment</Link>
            </>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ADJ# / note…" className={`${input} w-56`} />
        <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className={input}><option value="">All reasons</option>{REASONS.map((r) => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>{STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace('_', ' ') : 'All statuses'}</option>)}</select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">ADJ #</th><th className="px-3 py-2">Medicine</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Reason</th><th className="px-3 py-2 text-right">Value</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Requested</th></tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">Loading…</td></tr>}
            {!isLoading && data?.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">No adjustments recorded yet.</td></tr>}
            {data?.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                <td className="px-3 py-2"><Link to={`/stock-adjustments/${a.id}`} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">{a.adjustmentNumber}</Link></td>
                <td className="px-3 py-2">{a.medicineName}</td>
                <td className="px-3 py-2"><span className={a.direction === 'DECREASE' ? 'text-red-600' : 'text-green-600'}>{a.direction === 'DECREASE' ? '−' : '+'}{a.quantity}</span></td>
                <td className="px-3 py-2 text-xs text-gray-500">{REASON_LABELS[a.reasonCode]}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(a.value)}</td>
                <td className="px-3 py-2"><AdjustmentStatusBadge status={a.status} /></td>
                <td className="px-3 py-2 text-gray-500">{new Date(a.requestedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
