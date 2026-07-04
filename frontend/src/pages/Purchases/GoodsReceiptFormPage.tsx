import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiClientError } from '../../shared/api/client';
import { purchasesApi } from '../../features/purchases/api/purchases.api';
import { usePurchaseOrder, useSuppliers } from '../../features/purchases/hooks/usePurchases';
import { MedicinePicker } from '../../features/purchases/components/MedicinePicker';
import { GrnLineInput } from '../../features/purchases/types/purchase.types';

export function GoodsReceiptFormPage() {
  const [params] = useSearchParams();
  const poId = params.get('poId') ?? undefined;
  const navigate = useNavigate();
  const { data: po } = usePurchaseOrder(poId);
  const { data: suppliers } = useSuppliers();

  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<GrnLineInput[]>([]);
  const [varianceNote, setVarianceNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Pre-fill from PO (remaining quantities) when receiving against an order.
  useEffect(() => {
    if (po) {
      setLines(
        po.items
          .filter((it) => it.receivedQuantity < it.orderedQuantity)
          .map((it) => ({
            purchaseOrderItemId: it.id,
            medicineId: it.medicineId,
            medicineName: it.medicineName,
            orderedQuantity: it.orderedQuantity,
            alreadyReceived: it.receivedQuantity,
            receivedQuantity: it.orderedQuantity - it.receivedQuantity,
            freeQuantity: 0,
            batchNumber: '',
            expiryDate: '',
            actualUnitCost: it.expectedUnitCost,
            expectedUnitCost: it.expectedUnitCost,
          })),
      );
    }
  }, [po]);

  const isDirect = !poId;
  const update = (i: number, patch: Partial<GrnLineInput>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addDirectLine = (m: { id: string; name: string; costPrice?: number }) => {
    if (lines.some((l) => l.medicineId === m.id)) return;
    setLines((ls) => [...ls, { medicineId: m.id, medicineName: m.name, receivedQuantity: 1, freeQuantity: 0, batchNumber: '', expiryDate: '', actualUnitCost: m.costPrice ?? 0 }]);
  };

  const variancePct = (l: GrnLineInput) => (l.expectedUnitCost && l.expectedUnitCost > 0 ? ((l.actualUnitCost - l.expectedUnitCost) / l.expectedUnitCost) * 100 : 0);
  const anyVariance = lines.some((l) => Math.abs(variancePct(l)) > 10);

  const submit = async (varianceAcknowledged = false) => {
    setError(null);
    if (isDirect && !supplierId) return setError('Select a supplier for a direct receipt.');
    if (lines.length === 0) return setError('Add at least one line item.');
    for (const l of lines) {
      if (!l.batchNumber.trim()) return setError(`Batch number is required for ${l.medicineName}.`);
      if (!l.expiryDate) return setError(`Expiry date is required for ${l.medicineName}.`);
      if (l.receivedQuantity < 1) return setError(`Received quantity must be at least 1 for ${l.medicineName}.`);
    }
    setSaving(true);
    try {
      const res = await purchasesApi.createGrn({
        purchaseOrderId: poId,
        supplierId: isDirect ? supplierId : undefined,
        notes: notes || undefined,
        varianceAcknowledged,
        varianceNote: varianceNote || undefined,
        items: lines.map((l) => ({
          purchaseOrderItemId: l.purchaseOrderItemId,
          medicineId: l.medicineId,
          receivedQuantity: l.receivedQuantity,
          freeQuantity: l.freeQuantity,
          batchNumber: l.batchNumber,
          expiryDate: new Date(l.expiryDate).toISOString(),
          actualUnitCost: l.actualUnitCost,
          expiryOverridden: l.expiryOverridden,
          expiryOverrideReason: l.expiryOverrideReason,
        })),
      });
      const data = res.data as { purchaseOrderId?: string };
      navigate(poId ? `/purchases/${poId}` : data?.purchaseOrderId ? `/purchases/${data.purchaseOrderId}` : '/purchases');
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'VARIANCE_REQUIRES_ACK') {
        if (window.confirm(`${e.message}\n\nAcknowledge and proceed?`)) return submit(true);
      } else {
        setError(e instanceof ApiClientError ? e.message : 'Failed to confirm goods receipt.');
      }
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm';
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{po ? `Receive Goods — ${po.poNumber}` : 'Direct Goods Receipt'}</h1>
        <button onClick={() => navigate(po ? `/purchases/${poId}` : '/purchases')} className="text-sm text-gray-500 underline">Cancel</button>
      </div>

      {error && <div role="alert" className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {anyVariance && <div className="mb-3 rounded-md border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950 px-3 py-2 text-sm text-orange-700 dark:text-orange-300">⚠ One or more lines have a cost variance over 10% from the expected cost.</div>}

      {isDirect && (
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="block"><span className="text-xs text-gray-500">Supplier *</span>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={`${inputCls} block`}>
              <option value="">Select…</option>
              {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <div className="min-w-64"><MedicinePicker onSelect={addDirectLine} /></div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-2 py-2">Medicine</th>
              <th className="px-2 py-2">Batch #</th>
              <th className="px-2 py-2">Expiry</th>
              <th className="px-2 py-2">Recv</th>
              <th className="px-2 py-2">Free</th>
              <th className="px-2 py-2">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {lines.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">{isDirect ? 'Search to add items.' : 'Nothing left to receive on this PO.'}</td></tr>}
            {lines.map((l, i) => {
              const v = variancePct(l);
              const expired = l.expiryDate && new Date(l.expiryDate) <= new Date();
              return (
                <tr key={l.medicineId}>
                  <td className="px-2 py-2">
                    {l.medicineName}
                    {l.orderedQuantity !== undefined && <div className="text-xs text-gray-400">ordered {l.orderedQuantity}, recv {l.alreadyReceived}</div>}
                  </td>
                  <td className="px-2 py-2"><input value={l.batchNumber} onChange={(e) => update(i, { batchNumber: e.target.value })} className={`${inputCls} w-28`} aria-label="Batch number" /></td>
                  <td className="px-2 py-2">
                    <input type="date" value={l.expiryDate} min={l.expiryOverridden ? undefined : today} onChange={(e) => update(i, { expiryDate: e.target.value })} className={`${inputCls} w-36`} aria-label="Expiry date" />
                    {expired && (
                      <label className="mt-1 flex items-center gap-1 text-xs text-red-600">
                        <input type="checkbox" checked={!!l.expiryOverridden} onChange={(e) => update(i, { expiryOverridden: e.target.checked })} /> override
                      </label>
                    )}
                    {l.expiryOverridden && <input placeholder="reason" value={l.expiryOverrideReason ?? ''} onChange={(e) => update(i, { expiryOverrideReason: e.target.value })} className={`${inputCls} mt-1 w-36`} />}
                  </td>
                  <td className="px-2 py-2"><input type="number" min="1" value={l.receivedQuantity} onChange={(e) => update(i, { receivedQuantity: Number(e.target.value) })} className={`${inputCls} w-16`} aria-label="Received quantity" /></td>
                  <td className="px-2 py-2"><input type="number" min="0" value={l.freeQuantity} onChange={(e) => update(i, { freeQuantity: Number(e.target.value) })} className={`${inputCls} w-14`} aria-label="Free quantity" /></td>
                  <td className="px-2 py-2">
                    <input type="number" min="0" step="0.01" value={l.actualUnitCost} onChange={(e) => update(i, { actualUnitCost: Number(e.target.value) })} className={`${inputCls} w-20`} aria-label="Actual unit cost" />
                    {Math.abs(v) > 0.1 && <span className={`ml-1 text-xs ${Math.abs(v) > 10 ? 'text-orange-600' : 'text-gray-400'}`}>{v > 0 ? '+' : ''}{v.toFixed(0)}%</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <label className="block flex-1"><span className="text-xs text-gray-500">GRN Notes</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} block w-full`} />
        </label>
        <div className="flex gap-2">
          <button onClick={() => navigate(po ? `/purchases/${poId}` : '/purchases')} className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm">Cancel</button>
          <button onClick={() => submit()} disabled={saving || lines.length === 0} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Confirming…' : 'Confirm Receipt'}</button>
        </div>
      </div>
    </div>
  );
}
