import { useState } from 'react';
import { ApiClientError } from '../../../shared/api/client';
import { BatchRow, batchesApi } from '../api/batches.api';

/** Flag a batch as recalled — blocks it from any sale system-wide immediately. */
export function RecallFlagModal({ batch, onClose, onDone }: { batch: BatchRow; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [sourceReference, setSourceReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooShort = reason.trim().length < 10;

  const submit = async () => {
    if (tooShort) return;
    setBusy(true);
    setError(null);
    try {
      await batchesApi.flagRecall(batch.id, { reason: reason.trim(), sourceReference: sourceReference || undefined });
      onDone();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Recall failed.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-lg bg-white dark:bg-gray-900 p-5 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold text-purple-700 dark:text-purple-400">Recall batch {batch.batchNumber}</h2>
        <p className="mb-3 text-sm text-gray-500">{batch.medicineName} — {batch.currentQuantity} units. Flagging as recalled <strong>immediately blocks this batch from every sale</strong>, system-wide.</p>

        {error && <div role="alert" className="mb-2 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}

        <label className="mb-2 block"><span className="text-xs text-gray-500">Reason * (min 10 chars)</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={input} placeholder="e.g. Manufacturer recall — contamination risk in this lot." />
        </label>
        <label className="mb-4 block"><span className="text-xs text-gray-500">Manufacturer notice reference</span>
          <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} className={input} placeholder="MFR-RECALL-2026-…" />
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={busy || tooShort} className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">{busy ? 'Flagging…' : 'Confirm Recall'}</button>
        </div>
      </div>
    </div>
  );
}
