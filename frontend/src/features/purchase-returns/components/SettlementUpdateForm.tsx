import { useState } from 'react';
import { ApiClientError } from '../../../shared/api/client';
import { useUpdateSettlement } from '../hooks/purchaseReturns.hooks';
import { SETTLEMENT_LABELS, type SettlementStatus } from '../types/purchase-return.types';

const OPTIONS: SettlementStatus[] = ['PENDING', 'CREDITED', 'PARTIALLY_CREDITED', 'REJECTED'];

/** Accountant-facing: record the supplier's response (credit note, amount, variance). */
export function SettlementUpdateForm({ id, current, expected, onDone }: { id: string; current: SettlementStatus; expected: number; onDone: () => void }) {
  const [status, setStatus] = useState<SettlementStatus>(current);
  const [amount, setAmount] = useState('');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutate = useUpdateSettlement(id);
  const needsAmount = status === 'CREDITED' || status === 'PARTIALLY_CREDITED';
  const input = 'w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';

  const submit = () => {
    setError(null);
    mutate.mutate(
      { settlementStatus: status, actualCreditedAmount: needsAmount ? Number(amount) : undefined, supplierCreditNoteRef: ref || undefined, notes: note || undefined },
      { onSuccess: onDone, onError: (e) => setError(e instanceof ApiClientError ? e.message : 'Update failed.') },
    );
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Update settlement</h3>
      {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs text-gray-500">Status
          <select value={status} onChange={(e) => setStatus(e.target.value as SettlementStatus)} className={`mt-0.5 ${input}`}>{OPTIONS.map((s) => <option key={s} value={s}>{SETTLEMENT_LABELS[s]}</option>)}</select>
        </label>
        {needsAmount && (
          <label className="text-xs text-gray-500">Actual credited amount{status === 'PARTIALLY_CREDITED' ? ` (< ${expected})` : ''}
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={`mt-0.5 ${input}`} />
          </label>
        )}
        <label className="text-xs text-gray-500">Supplier credit note ref
          <input value={ref} onChange={(e) => setRef(e.target.value)} className={`mt-0.5 ${input}`} placeholder="CN-…" />
        </label>
        <label className="text-xs text-gray-500 sm:col-span-2">Note
          <input value={note} onChange={(e) => setNote(e.target.value)} className={`mt-0.5 ${input}`} />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <button onClick={submit} disabled={mutate.isPending || (needsAmount && !amount)} className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{mutate.isPending ? 'Saving…' : 'Save settlement'}</button>
      </div>
    </div>
  );
}
