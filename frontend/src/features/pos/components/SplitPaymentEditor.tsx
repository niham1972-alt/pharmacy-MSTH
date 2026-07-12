import { formatCurrency } from '../../dashboard/utils/formatCurrency';

export interface PaymentLine {
  method: string;
  amount: number;
  referenceNumber?: string;
  tenderedAmount?: number;
}

const METHODS = ['CASH', 'CARD', 'MOBILE', 'WALLET', 'INSURANCE'];
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Multi-payment editor — lines must sum to the grand total before Finalize.
 *  CASH lines capture the tendered amount and show a prominent Change Due. */
export function SplitPaymentEditor({ grandTotal, payments, onChange }: { grandTotal: number; payments: PaymentLine[]; onChange: (p: PaymentLine[]) => void }) {
  const paid = round2(payments.reduce((s, p) => s + (p.amount || 0), 0));
  const remaining = round2(grandTotal - paid);

  const update = (i: number, patch: Partial<PaymentLine>) => onChange(payments.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const add = () => onChange([...payments, { method: 'CASH', amount: Math.max(0, remaining) }]);
  const remove = (i: number) => onChange(payments.filter((_, idx) => idx !== i));

  const inp = 'rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm';

  return (
    <div className="space-y-2">
      {payments.map((p, i) => {
        const isCash = p.method === 'CASH';
        const tendered = p.tenderedAmount ?? 0;
        const change = round2(tendered - p.amount);
        return (
          <div key={i} className="rounded-md border border-gray-200 dark:border-gray-800 p-2">
            <div className="flex gap-1">
              <select value={p.method} onChange={(e) => update(i, { method: e.target.value })} className={inp}>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <label className="flex flex-1 items-center gap-1">
                <span className="text-xs text-gray-500">Amount</span>
                <input type="number" min="0" step="0.01" value={p.amount} onChange={(e) => update(i, { amount: Number(e.target.value) })} placeholder="Amount" className={`${inp} w-full`} aria-label="Payment amount" />
              </label>
              {payments.length > 1 && <button onClick={() => remove(i)} className="text-red-500" aria-label="Remove payment">✕</button>}
            </div>

            {isCash ? (
              <div className="mt-1.5">
                <label className="block">
                  <span className="text-xs text-gray-500">Tendered Amount (cash from customer)</span>
                  <input type="number" min="0" step="0.01" value={p.tenderedAmount ?? ''} onChange={(e) => update(i, { tenderedAmount: Number(e.target.value) })} placeholder="e.g. 500" className={`${inp} w-full`} aria-label="Tendered amount" />
                </label>
                {tendered > 0 && (
                  change >= 0 ? (
                    <div className="mt-1.5 flex items-center justify-between rounded-md bg-green-50 dark:bg-green-950 px-3 py-1.5 text-green-700 dark:text-green-300">
                      <span className="text-xs font-medium uppercase tracking-wide">Change Due</span>
                      <span className="text-xl font-bold tabular-nums">{formatCurrency(change)}</span>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex items-center justify-between rounded-md bg-orange-50 dark:bg-orange-950 px-3 py-1.5 text-orange-700 dark:text-orange-300">
                      <span className="text-xs font-medium uppercase tracking-wide">Short by</span>
                      <span className="text-base font-semibold tabular-nums">{formatCurrency(-change)}</span>
                    </div>
                  )
                )}
              </div>
            ) : (
              <label className="mt-1.5 block">
                <span className="text-xs text-gray-500">Reference # (optional)</span>
                <input value={p.referenceNumber ?? ''} onChange={(e) => update(i, { referenceNumber: e.target.value })} placeholder="txn / auth code" className={`${inp} w-full`} aria-label="Reference number" />
              </label>
            )}
          </div>
        );
      })}

      <button onClick={add} className="text-sm text-brand-600 dark:text-brand-400 underline">+ Add payment method</button>

      <div className={`flex justify-between rounded-md px-2 py-1 text-sm font-medium ${remaining === 0 ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300' : 'bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300'}`}>
        <span>Remaining to pay</span>
        <span className="tabular-nums">{formatCurrency(remaining)}</span>
      </div>
    </div>
  );
}
