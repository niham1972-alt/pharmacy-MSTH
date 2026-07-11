import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { REASON_LABELS } from '../types/sales-return.types';
import type { ReturnRateByMedicine, ReturnRateByReason } from '../types/sales-return.types';

function Bar({ pct, tone }: { pct: number; tone: string }) {
  return <div className="h-2 w-full rounded bg-gray-100 dark:bg-gray-800"><div className={`h-2 rounded ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>;
}

/** Return rate by medicine — flags items coming back unusually often (spec §5/§16). */
export function ReturnRateByMedicineChart({ rows }: { rows: ReturnRateByMedicine[] }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-gray-500">No returns in this period.</p>;
  const max = Math.max(...rows.map((r) => r.returnRatePercent ?? 0), 1);
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.medicineId} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
          <span className="truncate text-sm text-gray-800 dark:text-gray-200">{r.name}</span>
          <span className="text-right text-xs text-gray-500">{r.returnRatePercent != null ? `${r.returnRatePercent}%` : '—'} · {r.returnedQuantity}/{r.soldQuantity} · {formatCurrency(r.totalRefunded)}</span>
          <div className="col-span-2"><Bar pct={((r.returnRatePercent ?? 0) / max) * 100} tone={(r.returnRatePercent ?? 0) >= 20 ? 'bg-red-500' : (r.returnRatePercent ?? 0) >= 10 ? 'bg-amber-500' : 'bg-brand-500'} /></div>
        </div>
      ))}
    </div>
  );
}

export function ReturnRateByReasonChart({ rows }: { rows: ReturnRateByReason[] }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-gray-500">No returns in this period.</p>;
  const max = Math.max(...rows.map((r) => r.returnedQuantity), 1);
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.reasonCode} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
          <span className="truncate text-sm text-gray-800 dark:text-gray-200">{REASON_LABELS[r.reasonCode]}</span>
          <span className="text-right text-xs text-gray-500">{r.returnedQuantity} unit(s) · {r.lineCount} line(s) · {formatCurrency(r.totalRefunded)}</span>
          <div className="col-span-2"><Bar pct={(r.returnedQuantity / max) * 100} tone={r.reasonCode === 'DAMAGED_DEFECTIVE' ? 'bg-red-500' : 'bg-indigo-500'} /></div>
        </div>
      ))}
    </div>
  );
}
