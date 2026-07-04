import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { usePurchaseOrder, usePurchaseMutations } from '../../features/purchases/hooks/usePurchases';
import { POStatusBadge, PaymentStatusBadge } from '../../features/purchases/components/badges';

const CAN_MANAGE = ['super_admin', 'admin', 'inventory_manager'];
const CAN_APPROVE = ['super_admin', 'admin'];
const CAN_PAY = ['super_admin', 'admin', 'accountant'];

type Tab = 'items' | 'receipts' | 'payments';

export function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: po, isLoading, isError, refetch } = usePurchaseOrder(id);
  const { submit, approve, reject, cancel, recordPayment } = usePurchaseMutations();
  const [tab, setTab] = useState<Tab>('items');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [showPay, setShowPay] = useState(false);

  const canManage = CAN_MANAGE.includes(user?.role ?? '');
  const canApprove = CAN_APPROVE.includes(user?.role ?? '');
  const canPay = CAN_PAY.includes(user?.role ?? '');

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (isError || !po) return <div className="text-center"><p className="text-sm text-red-600">Couldn't load purchase order.</p><button onClick={() => refetch()} className="mt-1 text-sm underline">Retry</button></div>;

  const act = async (fn: () => Promise<unknown>) => { await fn(); refetch(); };
  const doReject = () => { const r = window.prompt('Reason for rejection?'); if (r) act(() => reject.mutateAsync({ id: po.id, reason: r })); };
  const doCancel = () => { const r = po.status === 'PARTIALLY_RECEIVED' ? window.prompt('Cancellation reason (required):') || undefined : undefined; if (po.status === 'PARTIALLY_RECEIVED' && !r) return; act(() => cancel.mutateAsync({ id: po.id, reason: r })); };
  const doPay = async () => {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return;
    try { await recordPayment.mutateAsync({ id: po.id, amount: amt, method: payMethod }); setShowPay(false); setPayAmount(''); refetch(); }
    catch (e) { alert((e as Error).message); }
  };

  const canReceive = canManage && ['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status);
  const canSubmit = canManage && po.status === 'DRAFT';
  const canApproveNow = canApprove && po.status === 'PENDING_APPROVAL';
  const canCancel = canManage && ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status);
  const canRecordPay = canPay && po.outstanding > 0 && ['APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(po.status);

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 py-1.5 text-sm"><span className="text-gray-500">{label}</span><span className="text-gray-900 dark:text-gray-100">{value}</span></div>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-2 text-sm text-gray-500"><Link to="/purchases" className="underline">Purchases</Link> / {po.poNumber}</div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{po.poNumber} {po.isDirectGrn && <span className="text-sm text-gray-400">(direct receipt)</span>}</h1>
          <p className="text-sm text-gray-500">{po.supplier.name} · ordered {new Date(po.orderDate).toLocaleDateString()}</p>
          <div className="mt-1 flex items-center gap-2"><POStatusBadge status={po.status} /><PaymentStatusBadge status={po.paymentStatus} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSubmit && <button onClick={() => act(() => submit.mutateAsync(po.id))} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">Submit</button>}
          {canApproveNow && <button onClick={() => act(() => approve.mutateAsync(po.id))} className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white">Approve</button>}
          {canApproveNow && <button onClick={doReject} className="rounded-md border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm text-red-600">Reject</button>}
          {canReceive && <Link to={`/purchases/receive?poId=${po.id}`} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">Receive Goods</Link>}
          {canRecordPay && <button onClick={() => setShowPay((s) => !s)} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Record Payment</button>}
          {canCancel && <button onClick={doCancel} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Cancel PO</button>}
        </div>
      </div>

      {showPay && (
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-md border border-gray-200 dark:border-gray-800 p-3">
          <label className="block"><span className="text-xs text-gray-500">Amount (outstanding {formatCurrency(po.outstanding)})</span>
            <input type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="block rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm" /></label>
          <label className="block"><span className="text-xs text-gray-500">Method</span>
            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="block rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm">
              {['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'].map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
            </select></label>
          <button onClick={doPay} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">Save Payment</button>
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><Row label="Sub Total" value={formatCurrency(po.subTotal)} /><Row label="Tax" value={formatCurrency(po.taxTotal)} /><Row label="Grand Total" value={<strong>{formatCurrency(po.grandTotal)}</strong>} /></div>
        <div><Row label="Amount Paid" value={formatCurrency(po.amountPaid)} /><Row label="Outstanding" value={formatCurrency(po.outstanding)} /><Row label="Due Date" value={po.dueDate ? new Date(po.dueDate).toLocaleDateString() : '—'} /></div>
      </div>

      <div role="tablist" className="mb-3 flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {([['items', 'Line Items'], ['receipts', `Receipts (${po.goodsReceipts.length})`], ['payments', `Payments (${po.payments.length})`]] as Array<[Tab, string]>).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-3 py-2 text-sm ${tab === k ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400 font-medium' : 'text-gray-500'}`}>{label}</button>
        ))}
      </div>

      {tab === 'items' && (
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-gray-500"><tr><th className="py-1">Medicine</th><th>Ordered</th><th>Received</th><th>Unit Cost</th><th className="text-right">Line Total</th></tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {po.items.map((it) => (
              <tr key={it.id}><td className="py-1.5">{it.medicineName}<span className="text-gray-400"> · {it.sku}</span></td><td>{it.orderedQuantity}</td><td>{it.receivedQuantity}</td><td>{formatCurrency(it.expectedUnitCost)}</td><td className="text-right">{formatCurrency(it.lineTotal)}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'receipts' && (
        <div>
          {po.goodsReceipts.length === 0 && <p className="text-sm text-gray-500">No goods received yet.</p>}
          {po.goodsReceipts.map((g) => (
            <div key={g.id} className="flex justify-between border-b border-gray-100 dark:border-gray-800 py-2 text-sm">
              <span>{g.grnNumber} · {g.itemCount} item(s) {g.hasVariance && <span className="ml-1 rounded bg-orange-100 dark:bg-orange-900/40 px-1 text-xs text-orange-700 dark:text-orange-300">variance</span>}</span>
              <span className="text-gray-500">{new Date(g.receivedDate).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'payments' && (
        <div>
          {po.payments.length === 0 && <p className="text-sm text-gray-500">No payments recorded.</p>}
          {po.payments.map((p) => (
            <div key={p.id} className="flex justify-between border-b border-gray-100 dark:border-gray-800 py-2 text-sm">
              <span>{formatCurrency(p.amount)} · {p.method.replace('_', ' ')}{p.referenceNumber ? ` · ${p.referenceNumber}` : ''}</span>
              <span className="text-gray-500">{new Date(p.paymentDate).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
