import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { ApiClientError } from '../../shared/api/client';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { useExpenseDetail } from '../../features/expenses/hooks/useExpenseDetail';
import { useExpenseMutations } from '../../features/expenses/hooks/useExpenseMutations';
import { PaymentStatusBadge } from '../../features/expenses/components/PaymentStatusBadge';
import { ApprovalStatusBadge } from '../../features/expenses/components/ApprovalStatusBadge';
import { PAYMENT_METHODS, ExpensePaymentMethod } from '../../features/expenses/types/expense.types';

const CAN_WRITE = ['super_admin', 'admin', 'accountant'];
const CAN_APPROVE = ['super_admin', 'admin'];
const inputCls = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm';

export function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: e, isLoading } = useExpenseDetail(id);
  const { approve, reject, recordPayment } = useExpenseMutations();

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<ExpensePaymentMethod>('CASH');
  const [payRef, setPayRef] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <div className="py-10 text-center text-gray-400">Loading…</div>;
  if (!e) return <div className="py-10 text-center text-gray-400">Expense not found.</div>;

  const canWrite = CAN_WRITE.includes(user?.role ?? '');
  const canApprove = CAN_APPROVE.includes(user?.role ?? '');
  const isPending = e.approvalStatus === 'PENDING_APPROVAL';
  const payable = e.approvalStatus !== 'PENDING_APPROVAL' && e.approvalStatus !== 'REJECTED' && e.paymentStatus !== 'PAID';

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); } catch (err) { setError(err instanceof ApiClientError ? err.message : 'Action failed.'); }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/expenses" className="text-sm text-brand-600 hover:underline">← Back to expenses</Link>

      <div className="mt-2 mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{e.expenseNumber}</h1>
          <p className="text-sm text-gray-500">{e.categoryName} · {e.payeeName}</p>
        </div>
        <div className="flex items-center gap-2">
          <PaymentStatusBadge status={e.paymentStatus} isOverdue={e.isOverdue} />
          <ApprovalStatusBadge status={e.approvalStatus} />
        </div>
      </div>

      {error && <div role="alert" className="mb-3 rounded-md bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-sm sm:grid-cols-3">
        <Field label="Amount" value={formatCurrency(e.amount)} />
        <Field label="Paid" value={formatCurrency(e.amountPaid)} />
        <Field label="Outstanding" value={formatCurrency(e.outstanding)} />
        <Field label="Incurred" value={new Date(e.incurredDate).toLocaleDateString()} />
        <Field label="Due" value={e.dueDate ? new Date(e.dueDate).toLocaleDateString() : '—'} />
        <Field label="Source" value={e.isRecurringGenerated ? 'Recurring (auto)' : 'One-off'} />
      </div>

      {e.notes && <p className="mt-3 rounded-md bg-gray-50 dark:bg-gray-900/40 p-3 text-sm text-gray-600 dark:text-gray-300">{e.notes}</p>}
      {e.rejectedReason && <p className="mt-3 rounded-md bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">Rejected: {e.rejectedReason}</p>}

      {e.receiptUrl && (
        <div className="mt-3">
          <h2 className="mb-1 text-sm font-semibold text-gray-800 dark:text-gray-200">Receipt / invoice</h2>
          {e.receiptUrl.startsWith('data:image') || /\.(png|jpe?g|gif|webp)$/i.test(e.receiptUrl)
            ? <img src={e.receiptUrl} alt="Receipt" className="max-h-64 rounded-md border border-gray-200 dark:border-gray-800" />
            : <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-600 hover:underline">Open attachment</a>}
        </div>
      )}

      {/* Approval actions (admin) */}
      {isPending && canApprove && (
        <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4">
          <p className="mb-2 text-sm text-amber-800 dark:text-amber-300">This expense exceeds the approval threshold and needs review before it can be paid.</p>
          <div className="flex gap-2">
            <button disabled={approve.isPending} onClick={() => void act(() => approve.mutateAsync(e.id))} className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">Approve</button>
            <button onClick={() => setShowReject((v) => !v)} className="rounded-md border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm text-red-700 dark:text-red-300">Reject</button>
          </div>
          {showReject && (
            <div className="mt-2 flex gap-2">
              <input value={rejectReason} onChange={(ev) => setRejectReason(ev.target.value)} placeholder="Reason for rejection" className={`${inputCls} flex-1`} />
              <button disabled={reject.isPending || rejectReason.trim().length < 3} onClick={() => void act(async () => { await reject.mutateAsync({ id: e.id, reason: rejectReason }); setShowReject(false); })} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">Confirm reject</button>
            </div>
          )}
        </div>
      )}

      {/* Record payment (admin/accountant) */}
      {payable && canWrite && (
        <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">Record a payment</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm"><span className="mb-1 block text-xs text-gray-500">Amount</span>
              <input type="number" step="0.01" min="0" value={payAmount} onChange={(ev) => setPayAmount(ev.target.value)} placeholder={String(e.outstanding)} className={inputCls} /></label>
            <label className="text-sm"><span className="mb-1 block text-xs text-gray-500">Method</span>
              <select value={payMethod} onChange={(ev) => setPayMethod(ev.target.value as ExpensePaymentMethod)} className={inputCls}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}</select></label>
            <label className="text-sm"><span className="mb-1 block text-xs text-gray-500">Reference</span>
              <input value={payRef} onChange={(ev) => setPayRef(ev.target.value)} placeholder="optional" className={inputCls} /></label>
            <button
              disabled={recordPayment.isPending || !(Number(payAmount) > 0)}
              onClick={() => void act(async () => { await recordPayment.mutateAsync({ id: e.id, body: { amount: Number(payAmount), method: payMethod, referenceNumber: payRef || undefined } }); setPayAmount(''); setPayRef(''); })}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >Record</button>
          </div>
        </div>
      )}

      {/* Payment history */}
      <div className="mt-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">Payment history</h2>
        {e.payments.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-200 dark:border-gray-800 p-4 text-center text-sm text-gray-400">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Method</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {e.payments.map((p) => (
                  <tr key={p.id}><td className="px-3 py-2 text-gray-500">{new Date(p.paymentDate).toLocaleDateString()}</td><td className="px-3 py-2">{p.method.replace('_', ' ')}</td><td className="px-3 py-2 text-gray-500">{p.referenceNumber ?? '—'}</td><td className="px-3 py-2 text-right">{formatCurrency(p.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-gray-400">{label}</p>
      <p className="font-medium text-gray-800 dark:text-gray-200">{value}</p>
    </div>
  );
}
