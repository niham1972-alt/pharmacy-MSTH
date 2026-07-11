import { Link, useParams } from 'react-router-dom';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { useSalesReturnDetail } from '../../features/sales-returns/hooks/salesReturns.hooks';
import { ReturnReceiptPreview } from '../../features/sales-returns/components/ReturnReceiptPreview';
import { REASON_LABELS, REFUND_LABELS } from '../../features/sales-returns/types/sales-return.types';

export function SalesReturnDetailPage() {
  const { id = '' } = useParams();
  const { data: ret, isLoading, isError, refetch } = useSalesReturnDetail(id);

  if (isLoading) return <p className="animate-pulse text-gray-400">Loading return…</p>;
  if (isError || !ret) return <p className="text-red-600">Couldn't load this return. <button onClick={() => refetch()} className="underline">Retry</button></p>;

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Return <span className="font-mono">{ret.returnNumber}</span></h1>
          <p className="text-sm text-gray-500">Against sale <Link to={`/sales/${ret.originalSaleId}`} className="font-mono text-brand-600 hover:underline">{ret.originalSaleNumber ?? ret.originalSaleId}</Link> · {new Date(ret.returnDate).toLocaleString()}</p>
        </div>
        <Link to="/sales-returns" className="text-sm text-brand-600 hover:underline">← All returns</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 text-left text-xs uppercase text-gray-500">
                <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Condition</th><th className="px-3 py-2">Reason</th><th className="px-3 py-2 text-right">Refund</th></tr>
              </thead>
              <tbody>
                {ret.items.map((i) => (
                  <tr key={i.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2">{i.name}{i.flaggedForReview && <span className="ml-1 rounded bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-400">review</span>}</td>
                    <td className="px-3 py-2">{i.quantityReturned}</td>
                    <td className="px-3 py-2">{i.conditionAssessment === 'RESALEABLE' ? <span className="text-green-600">restocked</span> : <span className="text-gray-500">not resaleable</span>}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{REASON_LABELS[i.reasonCode]}{i.reasonNote ? ` — ${i.reasonNote}` : ''}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(i.refundAmountForLine)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 dark:border-gray-800 p-4 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-gray-500">Refund method</dt><dd>{REFUND_LABELS[ret.refundMethod]}</dd></div>
            <div><dt className="text-xs text-gray-500">Total refunded</dt><dd className="font-semibold">{formatCurrency(ret.totalRefundAmount)}</dd></div>
            <div><dt className="text-xs text-gray-500">Processed by</dt><dd className="font-mono text-xs">{ret.processedBy.slice(0, 8)}</dd></div>
            <div><dt className="text-xs text-gray-500">Approved by</dt><dd className="font-mono text-xs">{ret.approvedBy ? ret.approvedBy.slice(0, 8) : '—'}</dd></div>
            {ret.refundReference && <div><dt className="text-xs text-gray-500">Reference</dt><dd>{ret.refundReference}</dd></div>}
            {ret.notes && <div className="col-span-full"><dt className="text-xs text-gray-500">Notes</dt><dd>{ret.notes}</dd></div>}
          </dl>
        </div>
        <ReturnReceiptPreview ret={ret} />
      </div>
    </div>
  );
}
