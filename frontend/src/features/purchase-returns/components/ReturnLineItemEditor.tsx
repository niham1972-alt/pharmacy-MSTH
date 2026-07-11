import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { REASON_LABELS } from '../types/purchase-return.types';
import type { PurchaseReturnReason, ReturnableLine } from '../types/purchase-return.types';

export interface DraftLine {
  selected: boolean;
  quantity: number;
  reasonCode: PurchaseReturnReason;
  reasonNote: string;
  relatedRecallId: string;
}
const REASONS = Object.keys(REASON_LABELS) as PurchaseReturnReason[];

/** One returnable GRN line: qty (≤ remaining & ≤ current batch stock), reason, note. */
export function ReturnLineItemEditor({ line, draft, onChange }: { line: ReturnableLine; draft: DraftLine; onChange: (d: DraftLine) => void }) {
  const input = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm';
  // Physically can't return more than what's still in the batch (spec §21).
  const maxQty = Math.min(line.remainingQuantity, line.currentBatchStock ?? line.remainingQuantity);

  return (
    <div className={`rounded-md border p-3 ${draft.selected ? 'border-brand-300 dark:border-brand-700 bg-brand-50/40 dark:bg-brand-900/10' : 'border-gray-200 dark:border-gray-800'}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={draft.selected} onChange={(e) => onChange({ ...draft, selected: e.target.checked })} className="mt-1" aria-label={`Return ${line.name}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{line.name}</span>
            <span className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">batch {line.batchNumber}</span>
            {!line.batchId && <span className="rounded bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-400">batch not found</span>}
          </div>
          <p className="text-xs text-gray-500">Received {line.receivedQuantity} · returned {line.alreadyReturnedQuantity} · <strong>{line.remainingQuantity} returnable</strong> · in stock {line.currentBatchStock ?? '—'} · {formatCurrency(line.unitCostAtReceipt)}/unit</p>

          {draft.selected && (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
              <label className="text-xs text-gray-500">Qty
                <input type="number" min={1} max={maxQty} value={draft.quantity} onChange={(e) => onChange({ ...draft, quantity: Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)) })} className={`mt-0.5 w-full ${input}`} />
              </label>
              <label className="text-xs text-gray-500 sm:col-span-3">Reason
                <select value={draft.reasonCode} onChange={(e) => onChange({ ...draft, reasonCode: e.target.value as PurchaseReturnReason })} className={`mt-0.5 w-full ${input}`}>
                  {REASONS.map((r) => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}
                </select>
              </label>
              {draft.reasonCode === 'QUALITY_RECALL' && (
                <input placeholder="Related recall id (optional)" value={draft.relatedRecallId} onChange={(e) => onChange({ ...draft, relatedRecallId: e.target.value })} className={`sm:col-span-4 w-full ${input}`} />
              )}
              <input placeholder="Note (optional)" value={draft.reasonNote} onChange={(e) => onChange({ ...draft, reasonNote: e.target.value })} className={`sm:col-span-4 w-full ${input}`} />
            </div>
          )}
        </div>
        {draft.selected && <div className="shrink-0 text-right text-sm font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(line.unitCostAtReceipt * draft.quantity)}</div>}
      </div>
    </div>
  );
}
