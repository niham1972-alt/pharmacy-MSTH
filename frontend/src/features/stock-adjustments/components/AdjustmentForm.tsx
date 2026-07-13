import { CreateAdjustmentInput, REASON_LABELS, AdjustmentReasonCode } from '../types/stock-adjustment.types';
import { MedicinePicker } from '../../purchases/components/MedicinePicker';

const REASONS = Object.keys(REASON_LABELS) as AdjustmentReasonCode[];
const input = 'w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';

/** Single-adjustment form body. `locked` (from a reconciliation link) hides the
 *  medicine picker and shows the pre-filled medicine + variance context. */
export function AdjustmentForm({
  value, onChange, medicineName, onMedicineName, locked = false, reconciliation,
}: {
  value: CreateAdjustmentInput;
  onChange: (v: CreateAdjustmentInput) => void;
  medicineName?: string;
  onMedicineName?: (name: string) => void;
  locked?: boolean;
  reconciliation?: { expectedQuantity: number; countedQuantity: number; variance: number } | null;
}) {
  const set = <K extends keyof CreateAdjustmentInput>(k: K, v: CreateAdjustmentInput[K]) => onChange({ ...value, [k]: v });

  const onEvidence = (file?: File) => {
    if (!file) return set('evidenceUrl', undefined);
    if (file.size > 2 * 1024 * 1024) return; // 2MB cap
    const r = new FileReader();
    r.onload = () => set('evidenceUrl', r.result as string);
    r.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      {locked ? (
        <div className="rounded-md border border-gray-200 dark:border-gray-800 p-3 text-sm">
          <div className="font-medium">{medicineName ?? value.medicineId}</div>
          {reconciliation && (
            <div className="mt-1 text-xs text-gray-500">
              Expected {reconciliation.expectedQuantity} · Counted {reconciliation.countedQuantity} · Variance{' '}
              <span className={reconciliation.variance < 0 ? 'text-red-600' : 'text-green-600'}>{reconciliation.variance > 0 ? '+' : ''}{reconciliation.variance}</span>
            </div>
          )}
        </div>
      ) : (
        <label className="block">
          <span className="text-xs text-gray-500">Medicine *</span>
          {value.medicineId ? (
            <div className="flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">
              <span>{medicineName ?? value.medicineId}</span>
              <button type="button" onClick={() => { set('medicineId', ''); }} className="text-xs text-gray-400 underline">change</button>
            </div>
          ) : (
            <MedicinePicker onSelect={(m) => { onChange({ ...value, medicineId: m.id }); onMedicineName?.(m.name); }} />
          )}
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="text-xs text-gray-500">Direction *</span>
          <select className={input} value={value.direction} onChange={(e) => set('direction', e.target.value as CreateAdjustmentInput['direction'])}>
            <option value="DECREASE">Decrease (−) — lost/damaged/miscount</option>
            <option value="INCREASE">Increase (+) — found/undercounted</option>
          </select>
        </label>
        <label className="block"><span className="text-xs text-gray-500">Quantity *</span>
          <input type="number" min="1" className={input} value={value.quantity} onChange={(e) => set('quantity', Math.max(1, Number(e.target.value)))} />
        </label>
      </div>

      <label className="block"><span className="text-xs text-gray-500">Reason code *</span>
        <select className={input} value={value.reasonCode} onChange={(e) => set('reasonCode', e.target.value as AdjustmentReasonCode)}>
          {REASONS.map((r) => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}
        </select>
      </label>

      {(value.reasonCode === 'OTHER' || value.reasonNote) && (
        <label className="block"><span className="text-xs text-gray-500">Reason note {value.reasonCode === 'OTHER' && '*'}</span>
          <textarea rows={2} className={input} value={value.reasonNote ?? ''} onChange={(e) => set('reasonNote', e.target.value)} placeholder="Explain the adjustment…" />
        </label>
      )}

      <label className="block"><span className="text-xs text-gray-500">Evidence (photo/document, optional, ≤2MB)</span>
        <input type="file" accept="image/*,application/pdf" className="mt-1 block text-sm" onChange={(e) => onEvidence(e.target.files?.[0])} />
        {value.evidenceUrl && <span className="text-xs text-green-600">✓ attached</span>}
      </label>
    </div>
  );
}
