import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { stockAdjustmentsApi } from '../../features/stock-adjustments/api/stock-adjustments.api';
import { AdjustmentStatusBadge } from '../../features/stock-adjustments/components/AdjustmentStatusBadge';
import { REASON_LABELS } from '../../features/stock-adjustments/types/stock-adjustment.types';
import { AuditTrailTab } from '../../features/audit-logs/components/AuditTrailTab';

export function StockAdjustmentDetailPage() {
  const { id = '' } = useParams();
  const { data: a, isLoading, isError } = useQuery({ queryKey: ['adjustment', id], queryFn: async () => (await stockAdjustmentsApi.detail(id)).data });

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (isError || !a) return <p className="text-sm text-red-600">Couldn't load adjustment.</p>;

  const row = (label: string, value: React.ReactNode) => (
    <div><p className="text-xs text-gray-500">{label}</p><p className="text-sm text-gray-900 dark:text-gray-100">{value}</p></div>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-sm text-gray-500"><Link to="/stock-adjustments" className="underline">Adjustments</Link> / {a.adjustmentNumber}</div>
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{a.adjustmentNumber}</h1>
        <AdjustmentStatusBadge status={a.status} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-gray-200 dark:border-gray-800 p-4 sm:grid-cols-3">
        {row('Medicine', a.medicineName)}
        {row('Direction / Qty', <span className={a.direction === 'DECREASE' ? 'text-red-600' : 'text-green-600'}>{a.direction === 'DECREASE' ? '−' : '+'}{a.quantity}</span>)}
        {row('Value', formatCurrency(a.value))}
        {row('Reason', REASON_LABELS[a.reasonCode])}
        {row('Requested by', <span className="font-mono text-xs">{a.requestedBy.slice(0, 8)}</span>)}
        {row('Requested at', new Date(a.requestedAt).toLocaleString())}
        {a.approvedBy && row('Approved by', <span className="font-mono text-xs">{a.approvedBy.slice(0, 8)}</span>)}
        {a.approvedAt && row('Decided at', new Date(a.approvedAt).toLocaleString())}
        {a.batchId && row('Batch', <span className="font-mono text-xs">{a.batchId.slice(0, 8)}</span>)}
      </div>

      {a.reasonNote && <div className="mb-3 rounded-md border border-gray-200 dark:border-gray-800 p-3 text-sm"><span className="text-xs text-gray-500">Note: </span>{a.reasonNote}</div>}
      {a.rejectedReason && <div className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">Rejected: {a.rejectedReason}</div>}

      {a.reconciliation && (
        <div className="mb-3 rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 p-3 text-sm">
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Linked reconciliation · </span>
          Expected {a.reconciliation.expectedQuantity} · Counted {a.reconciliation.countedQuantity} · Variance {a.reconciliation.variance} · <Link to="/inventory/reconciliation" className="underline">view</Link>
        </div>
      )}

      {a.evidenceUrl && (
        <div className="mb-4">
          <p className="mb-1 text-xs text-gray-500">Evidence</p>
          {a.evidenceUrl.startsWith('data:image') || /\.(png|jpe?g|gif|webp)/i.test(a.evidenceUrl)
            ? <img src={a.evidenceUrl} alt="Adjustment evidence" className="max-h-64 rounded-md border border-gray-200 dark:border-gray-800" />
            : <a href={a.evidenceUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-600 underline">Open attached document</a>}
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Audit Trail</h2>
        <AuditTrailTab entityType="STOCK_ADJUSTMENT" entityId={a.id} />
      </div>
    </div>
  );
}
