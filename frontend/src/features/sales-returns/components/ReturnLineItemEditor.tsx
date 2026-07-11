import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { REASON_LABELS } from '../types/sales-return.types';
import type { ConditionAssessment, EligibilityLine, ReturnReasonCode } from '../types/sales-return.types';

export interface DraftLine {
  selected: boolean;
  quantity: number;
  conditionAssessment: ConditionAssessment;
  reasonCode: ReturnReasonCode;
  reasonNote: string;
}

const REASONS = Object.keys(REASON_LABELS) as ReturnReasonCode[];

/** One editable eligible line: quantity, condition, reason, note (spec §9). */
export function ReturnLineItemEditor({ line, draft, onChange }: { line: EligibilityLine; draft: DraftLine; onChange: (d: DraftLine) => void }) {
  const unitRefund = line.remainingQuantity > 0 ? line.maxRefundForRemaining / line.remainingQuantity : 0;
  const input = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm';

  return (
    <div className={`rounded-md border p-3 ${draft.selected ? 'border-brand-300 dark:border-brand-700 bg-brand-50/40 dark:bg-brand-900/10' : 'border-gray-200 dark:border-gray-800'}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={draft.selected} onChange={(e) => onChange({ ...draft, selected: e.target.checked })} className="mt-1" aria-label={`Return ${line.name}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{line.name}</span>
            {line.prescriptionRequired && <span className="rounded bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-400">needs approval</span>}
          </div>
          <p className="text-xs text-gray-500">Purchased {line.purchasedQuantity} · already returned {line.alreadyReturnedQuantity} · <strong>{line.remainingQuantity} returnable</strong> · {formatCurrency(unitRefund)}/unit</p>

          {draft.selected && (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
              <label className="text-xs text-gray-500">Qty
                <input type="number" min={1} max={line.remainingQuantity} value={draft.quantity} onChange={(e) => onChange({ ...draft, quantity: Math.max(1, Math.min(line.remainingQuantity, Number(e.target.value) || 1)) })} className={`mt-0.5 w-full ${input}`} />
              </label>
              <label className="text-xs text-gray-500 sm:col-span-1">Condition
                <select value={draft.conditionAssessment} onChange={(e) => onChange({ ...draft, conditionAssessment: e.target.value as ConditionAssessment })} className={`mt-0.5 w-full ${input}`}>
                  <option value="RESALEABLE">Resaleable (restock)</option>
                  <option value="NOT_RESALEABLE">Not resaleable</option>
                </select>
              </label>
              <label className="text-xs text-gray-500 sm:col-span-2">Reason
                <select value={draft.reasonCode} onChange={(e) => onChange({ ...draft, reasonCode: e.target.value as ReturnReasonCode })} className={`mt-0.5 w-full ${input}`}>
                  {REASONS.map((r) => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}
                </select>
              </label>
              <input placeholder="Note (optional)" value={draft.reasonNote} onChange={(e) => onChange({ ...draft, reasonNote: e.target.value })} className={`sm:col-span-4 w-full ${input}`} />
            </div>
          )}
        </div>
        {draft.selected && <div className="shrink-0 text-right text-sm font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(unitRefund * draft.quantity)}</div>}
      </div>
    </div>
  );
}
