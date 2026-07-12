import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiClientError } from '../../shared/api/client';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { AmountOrPercentInput } from '../../shared/components/AmountOrPercentInput';
import { computeInvoice, computeLine, TaxDiscountMode } from '../../shared/pricing/grnPricing';
import { purchasesApi } from '../../features/purchases/api/purchases.api';
import { usePurchaseOrder, useSuppliers } from '../../features/purchases/hooks/usePurchases';
import { useLookups } from '../../features/medicines/hooks/useLookups';
import { MedicinePicker } from '../../features/purchases/components/MedicinePicker';
import { GrnInvoiceAdjustments, GrnLineInput } from '../../features/purchases/types/purchase.types';

/**
 * Add New Stock (Goods Receipt). Supplier-first for direct receipts, with a rich
 * line-item table: full packs + loose units + bonus, per-line discount / sales
 * tax / advance tax (each %-or-lumpsum), rack placement, and a live invoice total
 * that also carries invoice-level bulk adjustments. All maths mirror the server.
 */
export function GoodsReceiptFormPage() {
  const [params] = useSearchParams();
  const poId = params.get('poId') ?? undefined;
  const navigate = useNavigate();
  const { data: po } = usePurchaseOrder(poId);
  const { data: suppliers } = useSuppliers();
  const { racks } = useLookups();

  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<GrnLineInput[]>([]);
  const [invoice, setInvoice] = useState<GrnInvoiceAdjustments>({
    invoiceDiscountMode: 'AMOUNT', invoiceDiscountValue: 0,
    invoiceSalesTaxMode: 'PERCENT', invoiceSalesTaxValue: 0,
    invoiceAdvanceTaxMode: 'AMOUNT', invoiceAdvanceTaxValue: 0,
  });
  const [varianceNote, setVarianceNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const lineDefaults = {
    looseUnitQuantity: 0, freeQuantity: 0,
    discountMode: 'AMOUNT' as TaxDiscountMode, discountValue: 0,
    salesTaxMode: 'PERCENT' as TaxDiscountMode, salesTaxValue: 0,
    advanceTaxMode: 'AMOUNT' as TaxDiscountMode, advanceTaxValue: 0,
  };

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
            batchNumber: '', expiryDate: '', actualUnitCost: it.expectedUnitCost, expectedUnitCost: it.expectedUnitCost,
            ...lineDefaults,
          })),
      );
    }
  }, [po]);

  const isDirect = !poId;
  const update = (i: number, patch: Partial<GrnLineInput>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));
  const addDirectLine = (m: { id: string; name: string; costPrice?: number }) => {
    if (lines.some((l) => l.medicineId === m.id)) return;
    setLines((ls) => [...ls, { medicineId: m.id, medicineName: m.name, receivedQuantity: 1, batchNumber: '', expiryDate: '', actualUnitCost: m.costPrice ?? 0, ...lineDefaults }]);
  };

  const variancePct = (l: GrnLineInput) => (l.expectedUnitCost && l.expectedUnitCost > 0 ? ((l.actualUnitCost - l.expectedUnitCost) / l.expectedUnitCost) * 100 : 0);
  const anyVariance = lines.some((l) => Math.abs(variancePct(l)) > 10);

  const computedLines = useMemo(() => lines.map((l) => computeLine(l)), [lines]);
  const totals = useMemo(() => computeInvoice(computedLines.map((c) => c.net), invoice), [computedLines, invoice]);

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
        ...invoice,
        items: lines.map((l) => ({
          purchaseOrderItemId: l.purchaseOrderItemId,
          medicineId: l.medicineId,
          receivedQuantity: l.receivedQuantity,
          looseUnitQuantity: l.looseUnitQuantity || 0,
          freeQuantity: l.freeQuantity || 0,
          batchNumber: l.batchNumber,
          expiryDate: new Date(l.expiryDate).toISOString(),
          actualUnitCost: l.actualUnitCost,
          rackId: l.rackId || undefined,
          discountMode: l.discountMode, discountValue: l.discountValue || 0,
          salesTaxMode: l.salesTaxMode, salesTaxValue: l.salesTaxValue || 0,
          advanceTaxMode: l.advanceTaxMode, advanceTaxValue: l.advanceTaxValue || 0,
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

  const inp = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm';
  const th = 'px-2 py-2 whitespace-nowrap';
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{po ? `Receive Goods — ${po.poNumber}` : 'Add New Stock'}</h1>
        <button onClick={() => navigate(po ? `/purchases/${poId}` : '/purchases')} className="text-sm text-gray-500 underline">Cancel</button>
      </div>

      {error && <div role="alert" className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {anyVariance && <div className="mb-3 rounded-md border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950 px-3 py-2 text-sm text-orange-700 dark:text-orange-300">⚠ One or more lines have a cost variance over 10% from the expected cost.</div>}

      {isDirect && (
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="block"><span className="text-xs text-gray-500">Supplier *</span>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={`${inp} block`}>
              <option value="">Select…</option>
              {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <div className="min-w-72"><MedicinePicker onSelect={addDirectLine} /></div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
            <tr>
              <th className={th}>Medicine</th>
              <th className={th}>Batch #</th>
              <th className={th}>Expiry</th>
              <th className={th} title="Full packs">Qty</th>
              <th className={th} title="Loose base units">Loose</th>
              <th className={th} title="Bonus / free (unbilled)">Bonus</th>
              <th className={th}>Unit Cost</th>
              <th className={th}>Discount</th>
              <th className={th}>Sales Tax</th>
              <th className={th}>Adv. Tax</th>
              <th className={th}>Rack</th>
              <th className={`${th} text-right`}>Net</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {lines.length === 0 && <tr><td colSpan={13} className="px-3 py-6 text-center text-gray-400">{isDirect ? 'Search to add items.' : 'Nothing left to receive on this PO.'}</td></tr>}
            {lines.map((l, i) => {
              const v = variancePct(l);
              const expired = l.expiryDate && new Date(l.expiryDate) <= new Date();
              const c = computedLines[i];
              return (
                <tr key={l.medicineId} className="align-top">
                  <td className="px-2 py-2">
                    <div className="max-w-[10rem] truncate" title={l.medicineName}>{l.medicineName}</div>
                    {l.orderedQuantity !== undefined && <div className="text-xs text-gray-400">ord {l.orderedQuantity}, recv {l.alreadyReceived}</div>}
                  </td>
                  <td className="px-2 py-2"><input value={l.batchNumber} onChange={(e) => update(i, { batchNumber: e.target.value })} className={`${inp} w-24`} aria-label="Batch number" /></td>
                  <td className="px-2 py-2">
                    <input type="date" value={l.expiryDate} min={l.expiryOverridden ? undefined : today} onChange={(e) => update(i, { expiryDate: e.target.value })} className={`${inp} w-36`} aria-label="Expiry date" />
                    {expired && <label className="mt-1 flex items-center gap-1 text-xs text-red-600"><input type="checkbox" checked={!!l.expiryOverridden} onChange={(e) => update(i, { expiryOverridden: e.target.checked })} /> override</label>}
                    {l.expiryOverridden && <input placeholder="reason" value={l.expiryOverrideReason ?? ''} onChange={(e) => update(i, { expiryOverrideReason: e.target.value })} className={`${inp} mt-1 w-36`} />}
                  </td>
                  <td className="px-2 py-2"><input type="number" min="1" value={l.receivedQuantity} onChange={(e) => update(i, { receivedQuantity: Number(e.target.value) })} className={`${inp} w-14`} aria-label="Received quantity" /></td>
                  <td className="px-2 py-2"><input type="number" min="0" value={l.looseUnitQuantity ?? 0} onChange={(e) => update(i, { looseUnitQuantity: Number(e.target.value) })} className={`${inp} w-14`} aria-label="Loose units" /></td>
                  <td className="px-2 py-2"><input type="number" min="0" value={l.freeQuantity ?? 0} onChange={(e) => update(i, { freeQuantity: Number(e.target.value) })} className={`${inp} w-14`} aria-label="Bonus quantity" /></td>
                  <td className="px-2 py-2">
                    <input type="number" min="0" step="0.01" value={l.actualUnitCost} onChange={(e) => update(i, { actualUnitCost: Number(e.target.value) })} className={`${inp} w-20`} aria-label="Actual unit cost" />
                    {Math.abs(v) > 0.1 && <div className={`text-xs ${Math.abs(v) > 10 ? 'text-orange-600' : 'text-gray-400'}`}>{v > 0 ? '+' : ''}{v.toFixed(0)}%</div>}
                  </td>
                  <td className="px-2 py-2"><AmountOrPercentInput compact mode={l.discountMode ?? 'AMOUNT'} value={l.discountValue ?? 0} onChange={(m, val) => update(i, { discountMode: m, discountValue: val })} ariaLabel="Line discount" /></td>
                  <td className="px-2 py-2"><AmountOrPercentInput compact mode={l.salesTaxMode ?? 'PERCENT'} value={l.salesTaxValue ?? 0} onChange={(m, val) => update(i, { salesTaxMode: m, salesTaxValue: val })} ariaLabel="Line sales tax" /></td>
                  <td className="px-2 py-2"><AmountOrPercentInput compact mode={l.advanceTaxMode ?? 'AMOUNT'} value={l.advanceTaxValue ?? 0} onChange={(m, val) => update(i, { advanceTaxMode: m, advanceTaxValue: val })} ariaLabel="Line advance tax" /></td>
                  <td className="px-2 py-2">
                    <select value={l.rackId ?? ''} onChange={(e) => update(i, { rackId: e.target.value })} className={`${inp} w-24`} aria-label="Rack">
                      <option value="">—</option>{racks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-right font-medium whitespace-nowrap">{formatCurrency(c.net)}</td>
                  <td className="px-2 py-2"><button type="button" onClick={() => removeLine(i)} aria-label="Remove line" className="text-gray-400 hover:text-red-600">✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="block"><span className="text-xs text-gray-500">GRN Notes</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inp} block w-full`} />
          </label>
          {anyVariance && (
            <label className="block"><span className="text-xs text-gray-500">Variance note (optional)</span>
              <input value={varianceNote} onChange={(e) => setVarianceNote(e.target.value)} className={`${inp} block w-full`} />
            </label>
          )}
        </div>

        {/* Invoice-level totals + bulk adjustments */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 text-sm">
          <div className="flex items-center justify-between py-1"><span className="text-gray-500">Sub-total (line nets)</span><span className="font-medium">{formatCurrency(totals.subTotal)}</span></div>
          <div className="flex items-center justify-between py-1">
            <span className="text-gray-500">Bulk discount</span>
            <div className="flex items-center gap-2"><AmountOrPercentInput mode={invoice.invoiceDiscountMode ?? 'AMOUNT'} value={invoice.invoiceDiscountValue ?? 0} onChange={(m, val) => setInvoice((s) => ({ ...s, invoiceDiscountMode: m, invoiceDiscountValue: val }))} ariaLabel="Invoice discount" /><span className="w-20 text-right text-gray-500">−{formatCurrency(totals.invoiceDiscount)}</span></div>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-gray-500">Bulk sales tax</span>
            <div className="flex items-center gap-2"><AmountOrPercentInput mode={invoice.invoiceSalesTaxMode ?? 'PERCENT'} value={invoice.invoiceSalesTaxValue ?? 0} onChange={(m, val) => setInvoice((s) => ({ ...s, invoiceSalesTaxMode: m, invoiceSalesTaxValue: val }))} ariaLabel="Invoice sales tax" /><span className="w-20 text-right text-gray-500">+{formatCurrency(totals.invoiceSalesTax)}</span></div>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-gray-500">Bulk advance tax</span>
            <div className="flex items-center gap-2"><AmountOrPercentInput mode={invoice.invoiceAdvanceTaxMode ?? 'AMOUNT'} value={invoice.invoiceAdvanceTaxValue ?? 0} onChange={(m, val) => setInvoice((s) => ({ ...s, invoiceAdvanceTaxMode: m, invoiceAdvanceTaxValue: val }))} ariaLabel="Invoice advance tax" /><span className="w-20 text-right text-gray-500">+{formatCurrency(totals.invoiceAdvanceTax)}</span></div>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-gray-200 dark:border-gray-800 pt-2 text-base font-semibold"><span>Grand Total</span><span>{formatCurrency(totals.grandTotal)}</span></div>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={() => navigate(po ? `/purchases/${poId}` : '/purchases')} className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm">Cancel</button>
        <button onClick={() => submit()} disabled={saving || lines.length === 0} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Confirming…' : 'Confirm Receipt'}</button>
      </div>
    </div>
  );
}
