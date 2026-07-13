import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiClientError } from '../../shared/api/client';
import { MedicinePicker } from '../../features/purchases/components/MedicinePicker';
import { stockAdjustmentsApi } from '../../features/stock-adjustments/api/stock-adjustments.api';
import { CreateAdjustmentInput, REASON_LABELS, AdjustmentReasonCode, BulkResult } from '../../features/stock-adjustments/types/stock-adjustment.types';

const REASONS = Object.keys(REASON_LABELS) as AdjustmentReasonCode[];
type Row = CreateAdjustmentInput & { medicineName?: string };

export function BulkAdjustmentPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = (m: { id: string; name: string }) => { if (rows.some((r) => r.medicineId === m.id)) return; setRows((rs) => [...rs, { medicineId: m.id, medicineName: m.name, direction: 'DECREASE', quantity: 1, reasonCode: 'PHYSICAL_COUNT_CORRECTION' }]); };
  const upd = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const del = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const submit = async () => {
    setError(null);
    if (rows.length === 0) return setError('Add at least one line.');
    for (const r of rows) if (r.reasonCode === 'OTHER' && !r.reasonNote?.trim()) return setError('Each "Other" line needs a reason note.');
    setBusy(true);
    try {
      const res = (await stockAdjustmentsApi.bulk(rows.map(({ medicineName, ...r }) => { void medicineName; return r; }))).data;
      setResult(res);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Bulk submission failed.');
    } finally { setBusy(false); }
  };

  const inp = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm';

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Bulk Stock Adjustment</h1>
        <button onClick={() => nav('/stock-adjustments')} className="text-sm text-gray-500 underline">Back</button>
      </div>
      <p className="mb-3 text-sm text-gray-500">After a full physical count, enter several corrections at once. Each line is reason-coded and subject to the same auto-approve / approval threshold individually.</p>
      {error && <div role="alert" className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}

      {result ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <p className="mb-2 text-sm">Processed <strong>{result.total}</strong> lines: <span className="text-green-600">{result.succeeded} succeeded</span>, <span className="text-red-600">{result.failed} failed</span>.</p>
          <ul className="space-y-1 text-sm">
            {result.results.map((r) => (
              <li key={r.index} className={r.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                Line {r.index + 1} — {r.success ? `${r.adjustmentNumber} (${r.status})` : `failed: ${r.error}`}
              </li>
            ))}
          </ul>
          <button onClick={() => nav('/stock-adjustments')} className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Done</button>
        </div>
      ) : (
        <>
          <div className="mb-3 max-w-md"><MedicinePicker onSelect={add} /></div>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500"><tr><th className="px-2 py-2">Medicine</th><th className="px-2 py-2">Dir</th><th className="px-2 py-2">Qty</th><th className="px-2 py-2">Reason</th><th className="px-2 py-2">Note</th><th></th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">Search to add medicines.</td></tr>}
                {rows.map((r, i) => (
                  <tr key={r.medicineId}>
                    <td className="px-2 py-2">{r.medicineName}</td>
                    <td className="px-2 py-2"><select className={inp} value={r.direction} onChange={(e) => upd(i, { direction: e.target.value as Row['direction'] })}><option value="DECREASE">−</option><option value="INCREASE">+</option></select></td>
                    <td className="px-2 py-2"><input type="number" min="1" className={`${inp} w-16`} value={r.quantity} onChange={(e) => upd(i, { quantity: Math.max(1, Number(e.target.value)) })} /></td>
                    <td className="px-2 py-2"><select className={inp} value={r.reasonCode} onChange={(e) => upd(i, { reasonCode: e.target.value as AdjustmentReasonCode })}>{REASONS.map((rc) => <option key={rc} value={rc}>{REASON_LABELS[rc]}</option>)}</select></td>
                    <td className="px-2 py-2"><input className={`${inp} w-40`} value={r.reasonNote ?? ''} onChange={(e) => upd(i, { reasonNote: e.target.value })} placeholder={r.reasonCode === 'OTHER' ? 'required' : 'optional'} /></td>
                    <td className="px-2 py-2"><button onClick={() => del(i)} className="text-red-500">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end"><button onClick={() => void submit()} disabled={busy || rows.length === 0} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy ? 'Submitting…' : `Submit ${rows.length} adjustment(s)`}</button></div>
        </>
      )}
    </div>
  );
}
