import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiClientError } from '../../shared/api/client';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { purchasesApi } from '../../features/purchases/api/purchases.api';
import { useSuppliers } from '../../features/purchases/hooks/usePurchases';
import { MedicinePicker } from '../../features/purchases/components/MedicinePicker';
import { POLineInput } from '../../features/purchases/types/purchase.types';

export function PurchaseOrderFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: suppliers } = useSuppliers();
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [lines, setLines] = useState<POLineInput[]>([]);

  // Deep-link prefill from Inventory's reorder suggestions (spec §2.3).
  useEffect(() => {
    const prefill = (location.state as { prefill?: Array<{ medicineId: string; name: string; orderedQuantity: number }> } | null)?.prefill;
    if (prefill?.length) {
      setLines(prefill.map((p) => ({ medicineId: p.medicineId, medicineName: p.name, orderedQuantity: p.orderedQuantity, expectedUnitCost: 0 })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addLine = (m: { id: string; name: string; costPrice?: number }) => {
    if (lines.some((l) => l.medicineId === m.id)) return;
    setLines((ls) => [...ls, { medicineId: m.id, medicineName: m.name, orderedQuantity: 1, expectedUnitCost: m.costPrice ?? 0 }]);
  };
  const updateLine = (i: number, patch: Partial<POLineInput>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const subTotal = lines.reduce((s, l) => s + l.orderedQuantity * l.expectedUnitCost, 0);

  const save = async () => {
    setError(null);
    if (!supplierId) return setError('Select a supplier.');
    if (lines.length === 0) return setError('Add at least one line item.');
    if (lines.some((l) => l.orderedQuantity < 1)) return setError('Every line needs a quantity of at least 1.');
    setSaving(true);
    try {
      const res = await purchasesApi.createOrder({
        supplierId,
        notes: notes || undefined,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        items: lines.map((l) => ({ medicineId: l.medicineId, orderedQuantity: l.orderedQuantity, expectedUnitCost: l.expectedUnitCost })),
      });
      navigate(`/purchases/${res.data.id}`);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to create PO.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">New Purchase Order</h1>
        <button onClick={() => navigate('/purchases')} className="text-sm text-gray-500 underline">Cancel</button>
      </div>

      {error && <div role="alert" className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block"><span className="text-xs text-gray-500">Supplier *</span>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={`${inputCls} block w-full`}>
            <option value="">Select…</option>
            {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="block"><span className="text-xs text-gray-500">Expected Delivery</span>
          <input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className={`${inputCls} block w-full`} />
        </label>
        <label className="block"><span className="text-xs text-gray-500">Notes</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} block w-full`} />
        </label>
      </div>

      <div className="mb-3 max-w-md"><MedicinePicker onSelect={addLine} /></div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
            <tr><th className="px-3 py-2">Medicine</th><th className="px-3 py-2 w-28">Qty</th><th className="px-3 py-2 w-32">Unit Cost</th><th className="px-3 py-2 text-right">Line Total</th><th></th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {lines.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Search above to add line items.</td></tr>}
            {lines.map((l, i) => (
              <tr key={l.medicineId}>
                <td className="px-3 py-2">{l.medicineName}</td>
                <td className="px-3 py-2"><input type="number" min="1" value={l.orderedQuantity} onChange={(e) => updateLine(i, { orderedQuantity: Number(e.target.value) })} className={`${inputCls} w-24`} /></td>
                <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={l.expectedUnitCost} onChange={(e) => updateLine(i, { expectedUnitCost: Number(e.target.value) })} className={`${inputCls} w-28`} /></td>
                <td className="px-3 py-2 text-right">{formatCurrency(l.orderedQuantity * l.expectedUnitCost)}</td>
                <td className="px-3 py-2 text-right"><button onClick={() => removeLine(i)} aria-label="Remove line" className="text-red-500">×</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 dark:border-gray-800 font-medium">
              <td colSpan={3} className="px-3 py-2 text-right">Grand Total</td>
              <td className="px-3 py-2 text-right">{formatCurrency(subTotal)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={() => navigate('/purchases')} className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm">Cancel</button>
        <button onClick={save} disabled={saving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Saving…' : 'Create as Draft'}</button>
      </div>
    </div>
  );
}
