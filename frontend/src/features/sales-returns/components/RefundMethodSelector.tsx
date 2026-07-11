import { REFUND_LABELS } from '../types/sales-return.types';
import type { RefundMethod } from '../types/sales-return.types';

const METHODS = Object.keys(REFUND_LABELS) as RefundMethod[];

/** Refund method picker; store credit disabled for walk-in sales (spec §10). */
export function RefundMethodSelector({ value, onChange, reference, onReference, hasCustomer }: { value: RefundMethod; onChange: (m: RefundMethod) => void; reference: string; onReference: (s: string) => void; hasCustomer: boolean }) {
  const needsRef = value === 'CARD' || value === 'EXCHANGE';
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
      <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Refund method</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {METHODS.map((m) => {
          const disabled = m === 'STORE_CREDIT' && !hasCustomer;
          return (
            <button key={m} type="button" disabled={disabled} onClick={() => onChange(m)}
              className={`rounded-md border px-3 py-2 text-left text-xs ${value === m ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'} ${disabled ? 'cursor-not-allowed opacity-40' : 'hover:border-brand-400'}`}>
              {REFUND_LABELS[m]}{disabled && <span className="block text-[10px]">walk-in: N/A</span>}
            </button>
          );
        })}
      </div>
      {needsRef && (
        <input placeholder={value === 'CARD' ? 'Card reversal reference' : 'Replacement sale reference'} value={reference} onChange={(e) => onReference(e.target.value)} className="mt-2 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm" />
      )}
    </div>
  );
}
