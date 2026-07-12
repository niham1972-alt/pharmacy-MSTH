import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '../../shared/api/client';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { AmountOrPercentInput } from '../../shared/components/AmountOrPercentInput';
import { InlineCreateModal } from '../../shared/components/InlineCreateModal';
import { computeInvoice, computeLine, TaxDiscountMode } from '../../shared/pricing/grnPricing';
import { purchasesApi } from '../../features/purchases/api/purchases.api';
import { usePurchaseOrder, useSuppliers } from '../../features/purchases/hooks/usePurchases';
import { useLookups } from '../../features/medicines/hooks/useLookups';
import { medicinesApi, lookupsApi } from '../../features/medicines/api/medicines.api';
import { MedicinePicker } from '../../features/purchases/components/MedicinePicker';
import { GrnInvoiceAdjustments, GrnLineInput } from '../../features/purchases/types/purchase.types';

const MAX_ATTACH_BYTES = 2 * 1024 * 1024; // 2 MB per file
interface Attachment { fileName: string; fileUrl: string; fileType: string }

/**
 * Add New Stock (Goods Receipt). Supplier-first, with a full header (document #,
 * date, supplier invoice #/date, attachments), a multi-line item table with rich
 * computed columns (manufacturer, conversion, unit, available qty, retail, margin,
 * per-line %/₨ discount·tax·adv-tax, rack) and live invoice totals with bulk
 * %/₨ adjustments. All maths mirror the server, which stays authoritative.
 */
export function GoodsReceiptFormPage() {
  const [params] = useSearchParams();
  const poId = params.get('poId') ?? undefined;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: po } = usePurchaseOrder(poId);
  const { data: suppliers } = useSuppliers();
  const { racks } = useLookups();

  const [supplierId, setSupplierId] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
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
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [rackModalLine, setRackModalLine] = useState<number | null>(null);

  const lineDefaults = {
    looseUnitQuantity: 0, freeQuantity: 0,
    discountMode: 'AMOUNT' as TaxDiscountMode, discountValue: 0,
    salesTaxMode: 'PERCENT' as TaxDiscountMode, salesTaxValue: 0,
    advanceTaxMode: 'AMOUNT' as TaxDiscountMode, advanceTaxValue: 0,
    conversionFactor: 1,
  };

  // Pre-fill from PO (remaining quantities) when receiving against an order.
  useEffect(() => {
    if (po) {
      setSupplierId(po.supplier?.id ?? '');
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
      po.items.forEach((it, i) => it.receivedQuantity < it.orderedQuantity && void enrichLine(i, it.medicineId));
    }
  }, [po]);

  const isDirect = !poId;
  const update = (i: number, patch: Partial<GrnLineInput>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  // Auto-fill manufacturer / units / conversion / retail / available from the
  // medicine detail once a line's medicine is known.
  const enrichLine = async (index: number, medicineId: string) => {
    try {
      const d = (await medicinesApi.getById(medicineId)).data;
      const units = [d.purchaseUnit, d.baseUnit, d.saleUnit].filter(Boolean);
      const unitOptions = [...new Set(units.map((u) => u.name))];
      const conv = d.unitConversions?.find((c) => c.fromUnitId === d.purchaseUnit.id && c.toUnitId === d.baseUnit.id);
      setLines((ls) => ls.map((l) => (l.medicineId === medicineId ? {
        ...l,
        manufacturerName: d.manufacturer?.name,
        availableQty: d.currentStock,
        retailPrice: l.retailPrice ?? d.sellingPrice,
        unitName: l.unitName ?? d.purchaseUnit.name,
        unitOptions,
        conversionFactor: conv?.conversionFactor ?? l.conversionFactor ?? 1,
      } : l)));
    } catch { /* detail is best-effort enrichment */ }
  };

  const addDirectLine = (m: { id: string; name: string; costPrice?: number }) => {
    if (lines.some((l) => l.medicineId === m.id)) return;
    setLines((ls) => [...ls, { medicineId: m.id, medicineName: m.name, receivedQuantity: 1, batchNumber: '', expiryDate: '', actualUnitCost: m.costPrice ?? 0, ...lineDefaults }]);
    void enrichLine(lines.length, m.id);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACH_BYTES) { setError(`"${file.name}" is larger than 2 MB.`); continue; }
      const dataUrl: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file); });
      setAttachments((a) => [...a, { fileName: file.name, fileUrl: dataUrl, fileType: 'INVOICE' }]);
    }
  };

  const variancePct = (l: GrnLineInput) => (l.expectedUnitCost && l.expectedUnitCost > 0 ? ((l.actualUnitCost - l.expectedUnitCost) / l.expectedUnitCost) * 100 : 0);
  const anyVariance = lines.some((l) => Math.abs(variancePct(l)) > 10);

  const computedLines = useMemo(() => lines.map((l) => computeLine(l)), [lines]);
  const totals = useMemo(() => computeInvoice(computedLines.map((c) => c.net), invoice), [computedLines, invoice]);

  const marginPct = (l: GrnLineInput, net: number) => {
    const billed = l.receivedQuantity + (l.looseUnitQuantity ?? 0);
    const retail = l.retailPrice ?? 0;
    if (billed <= 0 || retail <= 0) return null;
    const netUnitCost = net / billed;
    return Math.round(((retail - netUnitCost) / retail) * 1000) / 10;
  };

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
        receivedDate: receivedDate ? new Date(receivedDate).toISOString() : undefined,
        supplierInvoiceNumber: supplierInvoiceNumber || undefined,
        supplierInvoiceDate: supplierInvoiceDate ? new Date(supplierInvoiceDate).toISOString() : undefined,
        attachments: attachments.length ? attachments.map((a) => ({ fileUrl: a.fileUrl, fileType: a.fileType, fileName: a.fileName })) : undefined,
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

  const createSupplier = async (v: Record<string, string>) => {
    const res = await purchasesApi.createSupplier({ name: v.name.trim(), phone: v.phone?.trim() || undefined });
    await qc.invalidateQueries({ queryKey: ['purchases', 'suppliers'] });
    setSupplierId(res.data.id);
    setShowAddSupplier(false);
  };
  const createRack = async (v: Record<string, string>) => {
    const res = await lookupsApi.create('racks', { name: v.name.trim() });
    await qc.invalidateQueries({ queryKey: ['lookups', 'racks'] });
    if (rackModalLine !== null) update(rackModalLine, { rackId: res.data.id });
    setRackModalLine(null);
  };

  const inp = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm';
  const th = 'px-2 py-2 whitespace-nowrap';
  const today = new Date().toISOString().slice(0, 10);
  const focusSearch = () => (document.querySelector('input[aria-label="Search medicine"]') as HTMLInputElement | null)?.focus();

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{po ? `Receive Goods — ${po.poNumber}` : 'Add New Stock'}</h1>
        <button onClick={() => navigate(po ? `/purchases/${poId}` : '/purchases')} className="text-sm text-gray-500 underline">Cancel</button>
      </div>

      {error && <div role="alert" className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {anyVariance && <div className="mb-3 rounded-md border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950 px-3 py-2 text-sm text-orange-700 dark:text-orange-300">⚠ One or more lines have a cost variance over 10% from the expected cost.</div>}

      {/* ---- Header ---- */}
      <div className="mb-4 grid gap-3 rounded-lg border border-gray-200 dark:border-gray-800 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block"><span className="text-xs text-gray-500">Document Number</span>
          <input disabled value="" placeholder="Auto-generated on save (GRN-…)" className={`${inp} block w-full cursor-not-allowed bg-gray-100 dark:bg-gray-900 text-gray-400`} />
        </label>
        <label className="block"><span className="text-xs text-gray-500">Date</span>
          <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className={`${inp} block w-full`} />
        </label>
        <label className="block"><span className="text-xs text-gray-500">Supplier {isDirect && '*'}</span>
          <div className="flex gap-1">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} disabled={!isDirect} className={`${inp} block w-full ${!isDirect ? 'cursor-not-allowed opacity-70' : ''}`}>
              <option value="">Select…</option>
              {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {isDirect && <button type="button" onClick={() => setShowAddSupplier(true)} title="Add supplier" className="shrink-0 rounded-md border border-gray-300 dark:border-gray-700 px-2 text-brand-600 hover:bg-gray-50 dark:hover:bg-gray-800">+</button>}
          </div>
        </label>
        <label className="block"><span className="text-xs text-gray-500">Supplier Invoice #</span>
          <input value={supplierInvoiceNumber} onChange={(e) => setSupplierInvoiceNumber(e.target.value)} className={`${inp} block w-full`} placeholder="e.g. INV-4471" />
        </label>
        <label className="block"><span className="text-xs text-gray-500">Supplier Invoice Date</span>
          <input type="date" value={supplierInvoiceDate} onChange={(e) => setSupplierInvoiceDate(e.target.value)} className={`${inp} block w-full`} />
        </label>
        <div className="block"><span className="text-xs text-gray-500">Attachments</span>
          <div className="mt-1 flex items-center gap-2">
            <label className="cursor-pointer rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
              + Add Attachment
              <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }} />
            </label>
            <span className="text-xs text-gray-400">{attachments.length ? `${attachments.length} file(s)` : 'invoice scan/photo'}</span>
          </div>
          {attachments.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {attachments.map((a, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <span className="max-w-[12rem] truncate">📎 {a.fileName}</span>
                  <button type="button" onClick={() => setAttachments((x) => x.filter((_, idx) => idx !== i))} aria-label={`Remove ${a.fileName}`} className="text-gray-400 hover:text-red-600">✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ---- Add item ---- */}
      <div className="mb-2 max-w-md"><MedicinePicker onSelect={addDirectLine} /></div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
            <tr>
              <th className={th}>Medicine</th>
              <th className={th}>Manufacturer</th>
              <th className={th}>Batch #</th>
              <th className={th}>Expiry</th>
              <th className={th}>Unit</th>
              <th className={th} title="Base units per pack">Conv.</th>
              <th className={th} title="Full packs">Qty</th>
              <th className={th} title="Loose base units">Loose</th>
              <th className={th} title="Bonus / free (unbilled)">Bonus</th>
              <th className={th} title="Current stock before this receipt">Avail.</th>
              <th className={th}>Unit Cost</th>
              <th className={th}>Discount</th>
              <th className={th}>Sales Tax</th>
              <th className={th}>Adv. Tax</th>
              <th className={th}>Retail</th>
              <th className={`${th} text-right`}>Net Retail</th>
              <th className={th}>Margin %</th>
              <th className={th}>Rack</th>
              <th className={`${th} text-right`}>Net</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {lines.length === 0 && <tr><td colSpan={20} className="px-3 py-6 text-center text-gray-400">{isDirect ? 'Search above to add items.' : 'Nothing left to receive on this PO.'}</td></tr>}
            {lines.map((l, i) => {
              const v = variancePct(l);
              const expired = l.expiryDate && new Date(l.expiryDate) <= new Date();
              const c = computedLines[i];
              const mg = marginPct(l, c.net);
              return (
                <tr key={l.medicineId} className="align-top">
                  <td className="px-2 py-2">
                    <div className="max-w-[9rem] truncate" title={l.medicineName}>{l.medicineName}</div>
                    {l.orderedQuantity !== undefined && <div className="text-xs text-gray-400">ord {l.orderedQuantity}, recv {l.alreadyReceived}</div>}
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-500"><div className="max-w-[8rem] truncate" title={l.manufacturerName}>{l.manufacturerName ?? '—'}</div></td>
                  <td className="px-2 py-2"><input value={l.batchNumber} onChange={(e) => update(i, { batchNumber: e.target.value })} className={`${inp} w-24`} aria-label="Batch number" /></td>
                  <td className="px-2 py-2">
                    <input type="date" value={l.expiryDate} min={l.expiryOverridden ? undefined : today} onChange={(e) => update(i, { expiryDate: e.target.value })} className={`${inp} w-36`} aria-label="Expiry date" />
                    {expired && <label className="mt-1 flex items-center gap-1 text-xs text-red-600"><input type="checkbox" checked={!!l.expiryOverridden} onChange={(e) => update(i, { expiryOverridden: e.target.checked })} /> override</label>}
                    {l.expiryOverridden && <input placeholder="reason" value={l.expiryOverrideReason ?? ''} onChange={(e) => update(i, { expiryOverrideReason: e.target.value })} className={`${inp} mt-1 w-36`} />}
                  </td>
                  <td className="px-2 py-2">
                    <select value={l.unitName ?? ''} onChange={(e) => update(i, { unitName: e.target.value })} className={`${inp} w-20`} aria-label="Unit">
                      {(l.unitOptions ?? (l.unitName ? [l.unitName] : [])).map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2"><input type="number" min="1" value={l.conversionFactor ?? 1} onChange={(e) => update(i, { conversionFactor: Number(e.target.value) })} className={`${inp} w-14`} aria-label="Conversion unit" /></td>
                  <td className="px-2 py-2"><input type="number" min="1" value={l.receivedQuantity} onChange={(e) => update(i, { receivedQuantity: Number(e.target.value) })} className={`${inp} w-14`} aria-label="Received quantity" /></td>
                  <td className="px-2 py-2"><input type="number" min="0" value={l.looseUnitQuantity ?? 0} onChange={(e) => update(i, { looseUnitQuantity: Number(e.target.value) })} className={`${inp} w-14`} aria-label="Loose units" /></td>
                  <td className="px-2 py-2"><input type="number" min="0" value={l.freeQuantity ?? 0} onChange={(e) => update(i, { freeQuantity: Number(e.target.value) })} className={`${inp} w-14`} aria-label="Bonus quantity" /></td>
                  <td className="px-2 py-2 text-xs text-gray-500">{l.availableQty ?? '—'}</td>
                  <td className="px-2 py-2">
                    <input type="number" min="0" step="0.01" value={l.actualUnitCost} onChange={(e) => update(i, { actualUnitCost: Number(e.target.value) })} className={`${inp} w-20`} aria-label="Actual unit cost" />
                    {Math.abs(v) > 0.1 && <div className={`text-xs ${Math.abs(v) > 10 ? 'text-orange-600' : 'text-gray-400'}`}>{v > 0 ? '+' : ''}{v.toFixed(0)}%</div>}
                  </td>
                  <td className="px-2 py-2"><AmountOrPercentInput compact mode={l.discountMode ?? 'AMOUNT'} value={l.discountValue ?? 0} onChange={(m, val) => update(i, { discountMode: m, discountValue: val })} ariaLabel="Line discount" /></td>
                  <td className="px-2 py-2"><AmountOrPercentInput compact mode={l.salesTaxMode ?? 'PERCENT'} value={l.salesTaxValue ?? 0} onChange={(m, val) => update(i, { salesTaxMode: m, salesTaxValue: val })} ariaLabel="Line sales tax" /></td>
                  <td className="px-2 py-2"><AmountOrPercentInput compact mode={l.advanceTaxMode ?? 'AMOUNT'} value={l.advanceTaxValue ?? 0} onChange={(m, val) => update(i, { advanceTaxMode: m, advanceTaxValue: val })} ariaLabel="Line advance tax" /></td>
                  <td className="px-2 py-2"><input type="number" min="0" step="0.01" value={l.retailPrice ?? 0} onChange={(e) => update(i, { retailPrice: Number(e.target.value) })} className={`${inp} w-20`} aria-label="Retail price" /></td>
                  <td className="px-2 py-2 text-right whitespace-nowrap text-gray-500">{formatCurrency(l.retailPrice ?? 0)}</td>
                  <td className="px-2 py-2 text-xs"><span className={mg !== null && mg < 0 ? 'text-red-600' : 'text-gray-500'}>{mg === null ? '—' : `${mg}%`}</span></td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <select value={l.rackId ?? ''} onChange={(e) => update(i, { rackId: e.target.value })} className={`${inp} w-20`} aria-label="Rack">
                        <option value="">—</option>{racks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <button type="button" onClick={() => setRackModalLine(i)} title="Add rack" className="shrink-0 rounded border border-gray-300 dark:border-gray-700 px-1 text-brand-600">+</button>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right font-medium whitespace-nowrap">{formatCurrency(c.net)}</td>
                  <td className="px-2 py-2"><button type="button" onClick={() => removeLine(i)} aria-label="Remove line" className="text-gray-400 hover:text-red-600">✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={focusSearch} className="mt-2 rounded-md border border-dashed border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm text-brand-600 hover:bg-gray-50 dark:hover:bg-gray-800">+ Add item</button>

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

      {showAddSupplier && <InlineCreateModal title="New Supplier" label="Supplier name" placeholder="e.g. Getz Pharma" extraFields={[{ key: 'phone', label: 'Phone (optional)', placeholder: '03xx-xxxxxxx' }]} onCreate={createSupplier} onClose={() => setShowAddSupplier(false)} />}
      {rackModalLine !== null && <InlineCreateModal title="New Rack" label="Rack name" placeholder="e.g. R-12" onCreate={createRack} onClose={() => setRackModalLine(null)} />}
    </div>
  );
}
