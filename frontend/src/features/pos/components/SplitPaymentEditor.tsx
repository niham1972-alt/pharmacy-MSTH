import { formatCurrency } from '../../dashboard/utils/formatCurrency';

export interface PaymentLine {
  method: string;
  amount: number;
  referenceNumber?: string;
  tenderedAmount?: number;
}

const METHODS = ['CASH', 'CARD', 'MOBILE', 'WALLET', 'INSURANCE'];

/** Multi-payment editor — lines must sum to the grand total before Finalize. */
export function SplitPaymentEditor({ grandTotal, payments, onChange }: { grandTotal: number; payments: PaymentLine[]; onChange: (p: PaymentLine[]) => void }) {
  const paid = Math.round(payments.reduce((s, p) => s + (p.amount || 0), 0) * 100) / 100;
  const remaining = Math.round((grandTotal - paid) * 100) / 100;

  const update = (i: number, patch: Partial<PaymentLine>) => onChange(payments.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const add = () => onChange([...payments, { method: 'CASH', amount: Math.max(0, remaining) }]);
  const remove = (i: number) => onChange(payments.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {payments.map((p, i) => (
        <div key={i} className="rounded-md border border-gray-200 dark:border-gray-800 p-2">
          <div className="flex gap-1">
            <select value={p.method} onChange={(e) => update(i, { method: e.target.value })} className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-1 text-sm">
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input type="number" min="0" step="0.01" value={p.amount} onChange={(e) => update(i, { amount: Number(e.target.value) })} placeholder="Amount" className="w-24 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm" aria-label="Payment amount" />
            {payments.length > 1 && <button onClick={() => remove(i)} className="text-red-500" aria-label="Remove payment">✕</button>}
          </div>
          {p.method === 'CASH' && (
            <div className="mt-1">
              <input type="number" min="0" value={p.tenderedAmount ?? ''} onChange={(e) => update(i, { tenderedAmount: Number(e.target.value) })} placeholder="Cash tendered" className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm" />
              {p.tenderedAmount != null && p.tenderedAmount >= p.amount && p.amount > 0 && <p className="mt-0.5 text-xs text-green-600">Change: {formatCurrency(p.tenderedAmount - p.amount)}</p>}
            </div>
          )}
          {p.method !== 'CASH' && (
            <input value={p.referenceNumber ?? ''} onChange={(e) => update(i, { referenceNumber: e.target.value })} placeholder="Reference #" className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm" />
          )}
        </div>
      ))}

      <button onClick={add} className="text-sm text-brand-600 dark:text-brand-400 underline">+ Add payment method</button>

      <div className={`flex justify-between rounded-md px-2 py-1 text-sm font-medium ${remaining === 0 ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300' : 'bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300'}`}>
        <span>Remaining to pay</span>
        <span>{formatCurrency(remaining)}</span>
      </div>
    </div>
  );
}
