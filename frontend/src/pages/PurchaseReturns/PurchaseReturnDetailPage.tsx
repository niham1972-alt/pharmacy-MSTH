import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { usePurchaseReturnDetail } from '../../features/purchase-returns/hooks/purchaseReturns.hooks';
import { SettlementStatusBadge } from '../../features/purchase-returns/components/SettlementStatusBadge';
import { SettlementUpdateForm } from '../../features/purchase-returns/components/SettlementUpdateForm';
import { ReturnDocumentPreview } from '../../features/purchase-returns/components/ReturnDocumentPreview';
import { REASON_LABELS } from '../../features/purchase-returns/types/purchase-return.types';

export function PurchaseReturnDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { data: ret, isLoading, isError, refetch } = usePurchaseReturnDetail(id);
  const canSettle = ['super_admin', 'admin', 'accountant'].includes(user?.role ?? '');

  if (isLoading) return <p className="animate-pulse text-gray-400">Loading return…</p>;
  if (isError || !ret) return <p className="text-red-600">Couldn't load this return. <button onClick={() => refetch()} className="underline">Retry</button></p>;

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100">Return <span className="font-mono">{ret.returnNumber}</span> <SettlementStatusBadge status={ret.settlementStatus} /></h1>
          <p className="text-sm text-gray-500">Supplier {ret.supplierName ?? ret.supplierId} · against GRN <Link to={`/purchases/grn/${ret.originalGrnId}`} className="font-mono text-brand-600 hover:underline">{ret.originalGrnNumber ?? ret.originalGrnId}</Link> · {new Date(ret.returnDate).toLocaleString()}</p>
        </div>
        <Link to="/purchase-returns" className="text-sm text-brand-600 hover:underline">← All returns</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 text-left text-xs uppercase text-gray-500">
                <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Reason</th><th className="px-3 py-2 text-right">Credit</th></tr>
              </thead>
              <tbody>
                {ret.items.map((i) => (
                  <tr key={i.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2">{i.name}{i.relatedRecallId && <Link to={`/batches/${i.batchId ?? ''}`} className="ml-1 rounded bg-red-50 dark:bg-red-950 px-1.5 py-0.5 text-[10px] text-red-600 dark:text-red-400">recall</Link>}</td>
                    <td className="px-3 py-2">{i.quantityReturned}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{REASON_LABELS[i.reasonCode]}{i.reasonNote ? ` — ${i.reasonNote}` : ''}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(i.lineCredit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 dark:border-gray-800 p-4 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-gray-500">Expected credit</dt><dd className="font-semibold">{formatCurrency(ret.expectedCreditAmount)}</dd></div>
            <div><dt className="text-xs text-gray-500">Actual credited</dt><dd>{ret.actualCreditedAmount != null ? formatCurrency(ret.actualCreditedAmount) : '—'}</dd></div>
            <div><dt className="text-xs text-gray-500">Variance</dt><dd className={ret.creditVariance != null && ret.creditVariance < 0 ? 'text-red-600' : ''}>{ret.creditVariance != null ? formatCurrency(ret.creditVariance) : '—'}</dd></div>
            {ret.supplierCreditNoteRef && <div><dt className="text-xs text-gray-500">Credit note ref</dt><dd>{ret.supplierCreditNoteRef}</dd></div>}
            {ret.notes && <div className="col-span-full"><dt className="text-xs text-gray-500">Notes</dt><dd>{ret.notes}</dd></div>}
          </dl>
          {canSettle && <SettlementUpdateForm id={ret.id} current={ret.settlementStatus} expected={ret.expectedCreditAmount} onDone={() => refetch()} />}
        </div>
        <ReturnDocumentPreview ret={ret} />
      </div>
    </div>
  );
}
