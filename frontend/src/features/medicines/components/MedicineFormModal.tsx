import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '../../../shared/api/client';
import { useLookups } from '../hooks/useLookups';
import { useMedicineMutations } from '../hooks/useMedicines';
import { lookupsApi, LookupKind } from '../api/medicines.api';
import { MedicineDetail, MedicineFormValues } from '../types/medicine.types';

const STORAGE_CONDITIONS = ['ROOM_TEMP', 'REFRIGERATED', 'FROZEN', 'CONTROLLED_ROOM_TEMP'];

const EMPTY: MedicineFormValues = {
  genericName: '', brandName: '', sku: '', manufacturerId: '', categoryId: '', dosageFormId: '',
  baseUnitId: '', purchaseUnitId: '', saleUnitId: '', rackId: '', strength: '', storageCondition: 'ROOM_TEMP',
  prescriptionRequired: false, controlledSubstanceSchedule: '', costPrice: 0, mrp: 0, sellingPrice: 0,
  taxRatePercent: 0, reorderLevel: 10, reorderQuantity: 50, openingStock: 0, openingStockExpiry: '', barcodes: [],
};

const inputCls = 'w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';

// Hoisted to module scope so they keep a stable identity across renders — a
// component defined inside the form would remount on each keystroke, stealing focus.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-gray-500">{label}</span>{children}</label>;
}
function AddBtn({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="shrink-0 rounded-md border border-gray-300 dark:border-gray-700 px-2 text-sm text-brand-600 hover:bg-gray-50 dark:hover:bg-gray-800" title="Quick add">+</button>;
}

/**
 * Add / Edit Medicine as a modal — two-column layout with inline quick-add for
 * Manufacturer / Category / Rack, a Narcotic toggle (forces prescription + a
 * controlled schedule) and an Opening Stock field that seeds a sellable batch.
 */
export function MedicineFormModal({ medicine, onClose, onSaved }: { medicine?: MedicineDetail; onClose: () => void; onSaved: (id: string) => void }) {
  const isEdit = !!medicine;
  const qc = useQueryClient();
  const { categories, manufacturers, dosageForms, units, racks } = useLookups();
  const { create, update } = useMedicineMutations();

  const [form, setForm] = useState<MedicineFormValues>(EMPTY);
  const [isNarcotic, setIsNarcotic] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (medicine) {
      setIsNarcotic(!!medicine.controlledSubstanceSchedule);
      setForm({
        genericName: medicine.genericName, brandName: medicine.brandName ?? '', sku: medicine.sku,
        manufacturerId: medicine.manufacturer.id, categoryId: medicine.category.id, dosageFormId: medicine.dosageForm.id,
        baseUnitId: medicine.baseUnit.id, purchaseUnitId: medicine.purchaseUnit.id, saleUnitId: medicine.saleUnit.id,
        rackId: medicine.rackId ?? '', strength: medicine.strength ?? '', routeOfAdministration: medicine.routeOfAdministration ?? '',
        storageCondition: medicine.storageCondition ?? 'ROOM_TEMP', prescriptionRequired: medicine.prescriptionRequired,
        controlledSubstanceSchedule: medicine.controlledSubstanceSchedule ?? '', costPrice: medicine.costPrice ?? 0,
        mrp: medicine.mrp, sellingPrice: medicine.sellingPrice, taxRatePercent: medicine.taxRatePercent,
        reorderLevel: medicine.reorderLevel, reorderQuantity: medicine.reorderQuantity, maxStockLevel: medicine.maxStockLevel ?? undefined,
        barcodes: medicine.barcodes.map((b) => b.barcode),
      });
    }
  }, [medicine]);

  const set = <K extends keyof MedicineFormValues>(key: K, value: MedicineFormValues[K]) => setForm((f) => ({ ...f, [key]: value }));

  const marginPct = useMemo(() => {
    const c = form.costPrice ?? 0, s = form.sellingPrice ?? 0;
    return s > 0 ? Math.round(((s - c) / s) * 1000) / 10 : null;
  }, [form.costPrice, form.sellingPrice]);

  const quickAdd = async (kind: LookupKind, field: keyof MedicineFormValues, label: string) => {
    const name = window.prompt(`New ${label} name:`)?.trim();
    if (!name) return;
    try {
      const res = await lookupsApi.create(kind, { name });
      await qc.invalidateQueries({ queryKey: ['lookups', kind] });
      set(field, res.data.id as MedicineFormValues[typeof field]);
    } catch (e) {
      setBanner(e instanceof ApiClientError ? e.message : `Could not add ${label}.`);
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.genericName || form.genericName.trim().length < 2) e.genericName = 'Required (min 2 chars).';
    for (const f of ['manufacturerId', 'categoryId', 'dosageFormId', 'baseUnitId', 'purchaseUnitId', 'saleUnitId'] as const) {
      if (!form[f]) e[f] = 'Required.';
    }
    if ((form.openingStock ?? 0) > 0 && !form.openingStockExpiry) e.openingStockExpiry = 'Expiry required for opening stock.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (extra: Partial<MedicineFormValues> = {}) => {
    setSaving(true);
    setBanner(null);
    const schedule = isNarcotic ? (form.controlledSubstanceSchedule?.trim() || 'NARCOTIC') : '';
    const payload: MedicineFormValues = {
      ...form,
      brandName: form.brandName || undefined,
      sku: form.sku || undefined,
      strength: form.strength || undefined,
      rackId: form.rackId || undefined,
      controlledSubstanceSchedule: schedule || undefined,
      prescriptionRequired: isNarcotic ? true : form.prescriptionRequired,
      openingStock: !isEdit && (form.openingStock ?? 0) > 0 ? form.openingStock : undefined,
      openingStockExpiry: !isEdit && (form.openingStock ?? 0) > 0 ? form.openingStockExpiry : undefined,
      ...extra,
    };
    try {
      if (isEdit) {
        const res = await update.mutateAsync({ id: medicine!.id, body: payload });
        onSaved(res.data.id);
      } else {
        const res = await create.mutateAsync(payload);
        onSaved(res.data.id);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'DUPLICATE_MEDICINE') {
          if (window.confirm('A similar medicine already exists. Create anyway?')) return submit({ ...extra, confirmDuplicate: true });
        } else if (err.code === 'NEGATIVE_MARGIN') {
          if (window.confirm('Selling price is below cost price (negative margin). Save anyway?')) return submit({ ...extra, confirmNegativeMargin: true });
        } else {
          setBanner(err.message);
        }
      } else {
        setBanner('Something went wrong.');
      }
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) { setBanner('Please fix the highlighted fields.'); return; }
    void submit();
  };

  const addBarcode = () => {
    const v = barcodeInput.trim();
    if (v && !form.barcodes?.includes(v)) set('barcodes', [...(form.barcodes ?? []), v]);
    setBarcodeInput('');
  };

  const err = (k: string) => errors[k] && <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{errors[k]}</p>;
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="block"><span className="text-xs text-gray-500">{label}</span>{children}</label>
  );
  const AddBtn = ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick} className="shrink-0 rounded-md border border-gray-300 dark:border-gray-700 px-2 text-sm text-brand-600 hover:bg-gray-50 dark:hover:bg-gray-800" title="Quick add">+</button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true">
      <form onSubmit={onSubmit} className="my-4 w-full max-w-4xl rounded-lg bg-white dark:bg-gray-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-5 py-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{isEdit ? 'Edit Medicine' : 'Add Medicine'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">✕</button>
        </div>

        {banner && <div role="alert" className="mx-5 mt-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{banner}</div>}

        <div className="grid max-h-[70vh] grid-cols-1 gap-x-6 gap-y-3 overflow-y-auto p-5 md:grid-cols-2">
          {/* ---- Left column: identification + clinical ---- */}
          <div className="space-y-3">
            <Field label="Generic Name *"><input className={inputCls} value={form.genericName} onChange={(e) => set('genericName', e.target.value)} />{err('genericName')}</Field>
            <Field label="Brand Name"><input className={inputCls} value={form.brandName ?? ''} onChange={(e) => set('brandName', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SKU (auto if blank)"><input className={inputCls} value={form.sku ?? ''} onChange={(e) => set('sku', e.target.value)} placeholder="MED-…" /></Field>
              <Field label="Strength"><input className={inputCls} value={form.strength ?? ''} onChange={(e) => set('strength', e.target.value)} placeholder="500mg" /></Field>
            </div>
            <Field label="Manufacturer *">
              <div className="flex gap-1">
                <select className={inputCls} value={form.manufacturerId} onChange={(e) => set('manufacturerId', e.target.value)}>
                  <option value="">Select…</option>{manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <AddBtn onClick={() => quickAdd('manufacturers', 'manufacturerId', 'manufacturer')} />
              </div>{err('manufacturerId')}
            </Field>
            <Field label="Category *">
              <div className="flex gap-1">
                <select className={inputCls} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                  <option value="">Select…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <AddBtn onClick={() => quickAdd('categories', 'categoryId', 'category')} />
              </div>{err('categoryId')}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dosage Form *">
                <div className="flex gap-1">
                  <select className={inputCls} value={form.dosageFormId} onChange={(e) => set('dosageFormId', e.target.value)}>
                    <option value="">Select…</option>{dosageForms.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <AddBtn onClick={() => quickAdd('dosageForms', 'dosageFormId', 'dosage form')} />
                </div>{err('dosageFormId')}
              </Field>
              <Field label="Storage Condition">
                <select className={inputCls} value={form.storageCondition ?? ''} onChange={(e) => set('storageCondition', e.target.value)}>
                  {STORAGE_CONDITIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Route of Administration"><input className={inputCls} value={form.routeOfAdministration ?? ''} onChange={(e) => set('routeOfAdministration', e.target.value)} placeholder="Oral" /></Field>
            <div className="rounded-md border border-gray-200 dark:border-gray-800 p-2 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isNarcotic} onChange={(e) => setIsNarcotic(e.target.checked)} />
                Narcotic / controlled substance
              </label>
              {isNarcotic && (
                <input className={inputCls} value={form.controlledSubstanceSchedule ?? ''} onChange={(e) => set('controlledSubstanceSchedule', e.target.value)} placeholder="Schedule (e.g. Schedule II)" />
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isNarcotic || !!form.prescriptionRequired} disabled={isNarcotic} onChange={(e) => set('prescriptionRequired', e.target.checked)} />
                Prescription required {isNarcotic && <span className="text-xs text-amber-600">(forced for narcotics)</span>}
              </label>
            </div>
          </div>

          {/* ---- Right column: packaging + pricing + stock ---- */}
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Field label="Base Unit *"><select className={inputCls} value={form.baseUnitId} onChange={(e) => set('baseUnitId', e.target.value)}><option value="">…</option>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>{err('baseUnitId')}</Field>
              <Field label="Purchase *"><select className={inputCls} value={form.purchaseUnitId} onChange={(e) => set('purchaseUnitId', e.target.value)}><option value="">…</option>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>{err('purchaseUnitId')}</Field>
              <Field label="Sale *"><select className={inputCls} value={form.saleUnitId} onChange={(e) => set('saleUnitId', e.target.value)}><option value="">…</option>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>{err('saleUnitId')}</Field>
            </div>
            <Field label="Rack / Shelf">
              <div className="flex gap-1">
                <select className={inputCls} value={form.rackId ?? ''} onChange={(e) => set('rackId', e.target.value)}>
                  <option value="">None</option>{racks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <AddBtn onClick={() => quickAdd('racks', 'rackId', 'rack')} />
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cost Price"><input type="number" step="0.01" min="0" className={inputCls} value={form.costPrice ?? 0} onChange={(e) => set('costPrice', Number(e.target.value))} /></Field>
              <Field label="Selling Price"><input type="number" step="0.01" min="0" className={inputCls} value={form.sellingPrice ?? 0} onChange={(e) => set('sellingPrice', Number(e.target.value))} /></Field>
              <Field label="MRP"><input type="number" step="0.01" min="0" className={inputCls} value={form.mrp ?? 0} onChange={(e) => set('mrp', Number(e.target.value))} /></Field>
              <Field label="Tax Rate %"><input type="number" step="0.01" min="0" max="100" className={inputCls} value={form.taxRatePercent ?? 0} onChange={(e) => set('taxRatePercent', Number(e.target.value))} /></Field>
            </div>
            {marginPct !== null && <p className={`text-xs ${marginPct < 0 ? 'text-red-600' : 'text-gray-400'}`}>Margin: {marginPct}%</p>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Reorder Level"><input type="number" min="0" className={inputCls} value={form.reorderLevel ?? 0} onChange={(e) => set('reorderLevel', Number(e.target.value))} /></Field>
              <Field label="Reorder Qty"><input type="number" min="0" className={inputCls} value={form.reorderQuantity ?? 0} onChange={(e) => set('reorderQuantity', Number(e.target.value))} /></Field>
            </div>
            {!isEdit && (
              <div className="grid grid-cols-2 gap-3 rounded-md border border-gray-200 dark:border-gray-800 p-2">
                <Field label="Opening Stock"><input type="number" min="0" className={inputCls} value={form.openingStock ?? 0} onChange={(e) => set('openingStock', Number(e.target.value))} /></Field>
                <Field label="Opening Batch Expiry"><input type="date" className={inputCls} value={form.openingStockExpiry ?? ''} onChange={(e) => set('openingStockExpiry', e.target.value)} disabled={(form.openingStock ?? 0) <= 0} />{err('openingStockExpiry')}</Field>
                <p className="col-span-2 text-[11px] text-gray-400">Creates a sellable "OPENING" batch. Leave stock 0 to receive via GRN instead.</p>
              </div>
            )}
            {isEdit && <p className="text-[11px] text-gray-400">Stock is managed via Inventory / GRN, not editable here.</p>}
            <Field label="Barcodes">
              <div className="flex gap-2">
                <input className={inputCls} value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBarcode(); } }} placeholder="Scan or type, Enter to add" />
                <button type="button" onClick={addBarcode} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 text-sm">Add</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {form.barcodes?.map((b) => (
                  <span key={b} className="inline-flex items-center gap-1 rounded bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs">{b}
                    <button type="button" onClick={() => set('barcodes', form.barcodes?.filter((x) => x !== b))} aria-label={`Remove ${b}`}>×</button>
                  </span>
                ))}
              </div>
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-800 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create medicine'}
          </button>
        </div>
      </form>
    </div>
  );
}
