import { useState } from 'react';
import { ApiClientError } from '../../../shared/api/client';
import { BatchRow, batchesApi } from '../api/batches.api';

const DISPOSAL_METHODS = [
  { value: 'RETURNED_TO_SUPPLIER', label: 'Returned to supplier' },
  { value: 'DESTROYED_ONSITE', label: 'Destroyed on-site' },
  { value: 'THIRD_PARTY_DISPOSAL', label: 'Third-party disposal' },
  { value: 'OTHER', label: 'Other' },
];

/** Destructive-action modal: multi-select batches + capture disposal reason. */
export function WriteOffModal({ batches, onClose, onDone }: { batches: BatchRow[]; onClose: () => void; onDone: () => void }) {
  const [disposalMethod, setDisposalMethod] = useState('');
  const [disposalReference, setDisposalReference] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!disposalMethod) return;
    setBusy(true);
    setError(null);
    try {
      await batchesApi.writeOff({
        batches: batches.map((b) => ({ batchId: b.id, quantity: b.currentQuantity })),
        disposalMethod,
        disposalReference: disposalReference || undefined,
        notes: notes || undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Write-off failed.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-lg bg-white dark:bg-gray-900 p-5 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold text-red-700 dark:text-red-400">Write off {batches.length} batch(es)</h2>
        <p className="mb-3 text-sm text-gray-500">This permanently removes the stock from sellable inventory and creates a compliance record. <strong>This cannot be undone.</strong></p>

        <div className="mb-3 max-h-32 overflow-auto rounded-md border border-gray-200 dark:border-gray-800 text-sm">
          {batches.map((b) => (
            <div key={b.id} className="flex justify-between px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <span>{b.medicineName} · <span className="text-gray-500">{b.batchNumber}</span></span>
              <span className="font-medium">{b.currentQuantity} units</span>
            </div>
          ))}
        </div>

        {error && <div role="alert" className="mb-2 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}

        <label className="mb-2 block"><span className="text-xs text-gray-500">Disposal method *</span>
          <select value={disposalMethod} onChange={(e) => setDisposalMethod(e.target.value)} className={input}>
            <option value="">Select…</option>
            {DISPOSAL_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        <label className="mb-2 block"><span className="text-xs text-gray-500">Disposal reference (certificate no.)</span>
          <input value={disposalReference} onChange={(e) => setDisposalReference(e.target.value)} className={input} />
        </label>
        <label className="mb-4 block"><span className="text-xs text-gray-500">Notes</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={busy || !disposalMethod} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">{busy ? 'Writing off…' : 'Confirm Write-Off'}</button>
        </div>
      </div>
    </div>
  );
}
