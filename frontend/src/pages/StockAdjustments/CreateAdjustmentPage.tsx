import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiClientError } from '../../shared/api/client';
import { stockAdjustmentsApi } from '../../features/stock-adjustments/api/stock-adjustments.api';
import { AdjustmentForm } from '../../features/stock-adjustments/components/AdjustmentForm';
import { CreateAdjustmentInput } from '../../features/stock-adjustments/types/stock-adjustment.types';

/** If navigated from Module 5's Reconciliation view, query params pre-fill the
 *  medicine + variance and lock the medicine selection. */
export function CreateAdjustmentPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const reconciliationId = params.get('reconciliationId') ?? undefined;
  const variance = params.has('variance') ? Number(params.get('variance')) : undefined;
  const locked = !!reconciliationId;

  const [medicineName, setMedicineName] = useState(params.get('medicineName') ?? '');
  const [form, setForm] = useState<CreateAdjustmentInput>({
    medicineId: params.get('medicineId') ?? '',
    direction: variance !== undefined ? (variance < 0 ? 'DECREASE' : 'INCREASE') : 'DECREASE',
    quantity: variance !== undefined ? Math.abs(variance) || 1 : 1,
    reasonCode: reconciliationId ? 'PHYSICAL_COUNT_CORRECTION' : 'DAMAGED_BREAKAGE',
    linkedReconciliationId: reconciliationId,
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!form.medicineId) return setError('Select a medicine.');
    if (form.reasonCode === 'OTHER' && !form.reasonNote?.trim()) return setError('A reason note is required for "Other".');
    setBusy(true);
    try {
      const res = (await stockAdjustmentsApi.create(form)).data;
      setResult(res.status === 'AUTO_APPROVED'
        ? `✓ ${res.adjustmentNumber} auto-approved — stock updated immediately.`
        : `✓ ${res.adjustmentNumber} created and is now Pending Approval (above the auto-approve threshold). An admin must review it.`);
      setTimeout(() => nav(`/stock-adjustments/${res.id}`), 1200);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to create adjustment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{locked ? 'Resolve Reconciliation → Adjustment' : 'Create Stock Adjustment'}</h1>
        <button onClick={() => nav('/stock-adjustments')} className="text-sm text-gray-500 underline">Cancel</button>
      </div>
      {error && <div role="alert" className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {result && <div className="mb-3 rounded-md border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950 px-3 py-2 text-sm text-green-700 dark:text-green-300">{result}</div>}

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <AdjustmentForm
          value={form}
          onChange={setForm}
          medicineName={medicineName}
          onMedicineName={setMedicineName}
          locked={locked}
          reconciliation={variance !== undefined ? { expectedQuantity: Number(params.get('expected') ?? 0), countedQuantity: Number(params.get('counted') ?? 0), variance } : null}
        />
        <p className="mt-3 text-xs text-gray-400">Small corrections auto-approve; larger ones (by quantity or value, per Settings) go to an admin for approval before any stock changes.</p>
        <div className="mt-4 flex justify-end">
          <button onClick={() => void submit()} disabled={busy || !!result} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy ? 'Submitting…' : 'Submit adjustment'}</button>
        </div>
      </div>
    </div>
  );
}
