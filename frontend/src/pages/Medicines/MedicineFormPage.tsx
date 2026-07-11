import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiClientError } from '../../shared/api/client';
import { useLookups } from '../../features/medicines/hooks/useLookups';
import { useMedicineDetail, useMedicineMutations } from '../../features/medicines/hooks/useMedicines';
import { MedicineFormValues } from '../../features/medicines/types/medicine.types';

const STORAGE_CONDITIONS = ['ROOM_TEMP', 'REFRIGERATED', 'FROZEN', 'CONTROLLED_ROOM_TEMP'];

/**
 * Defined at module scope — NOT inside the page component. If it were nested, a
 * fresh function identity on every render would remount the whole section
 * (inputs included) on each keystroke, stealing focus after one character.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const EMPTY: MedicineFormValues = {
  genericName: '',
  brandName: '',
  sku: '',
  manufacturerId: '',
  categoryId: '',
  dosageFormId: '',
  baseUnitId: '',
  purchaseUnitId: '',
  saleUnitId: '',
  strength: '',
  storageCondition: 'ROOM_TEMP',
  prescriptionRequired: false,
  controlledSubstanceSchedule: '',
  costPrice: 0,
  mrp: 0,
  sellingPrice: 0,
  taxRatePercent: 0,
  reorderLevel: 10,
  reorderQuantity: 50,
  currentStock: 0,
  barcodes: [],
};

export function MedicineFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { categories, manufacturers, dosageForms, units } = useLookups();
  const { create, update } = useMedicineMutations();
  const detail = useMedicineDetail(id);

  const [form, setForm] = useState<MedicineFormValues>(EMPTY);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && detail.data) {
      const d = detail.data;
      setForm({
        genericName: d.genericName,
        brandName: d.brandName ?? '',
        sku: d.sku,
        manufacturerId: d.manufacturer.id,
        categoryId: d.category.id,
        dosageFormId: d.dosageForm.id,
        baseUnitId: d.baseUnit.id,
        purchaseUnitId: d.purchaseUnit.id,
        saleUnitId: d.saleUnit.id,
        strength: d.strength ?? '',
        routeOfAdministration: d.routeOfAdministration ?? '',
        therapeuticClass: d.therapeuticClass ?? '',
        storageCondition: d.storageCondition ?? 'ROOM_TEMP',
        prescriptionRequired: d.prescriptionRequired,
        controlledSubstanceSchedule: d.controlledSubstanceSchedule ?? '',
        costPrice: d.costPrice ?? 0,
        mrp: d.mrp,
        sellingPrice: d.sellingPrice,
        taxRatePercent: d.taxRatePercent,
        reorderLevel: d.reorderLevel,
        reorderQuantity: d.reorderQuantity,
        maxStockLevel: d.maxStockLevel ?? undefined,
        currentStock: d.currentStock,
        barcodes: d.barcodes.map((b) => b.barcode),
      });
    }
  }, [isEdit, detail.data]);

  const set = <K extends keyof MedicineFormValues>(key: K, value: MedicineFormValues[K]) => setForm((f) => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.genericName || form.genericName.trim().length < 2) e.genericName = 'Generic name is required (min 2 chars).';
    for (const f of ['manufacturerId', 'categoryId', 'dosageFormId', 'baseUnitId', 'purchaseUnitId', 'saleUnitId'] as const) {
      if (!form[f]) e[f] = 'Required.';
    }
    if ((form.sellingPrice ?? 0) < 0 || (form.costPrice ?? 0) < 0) e.pricing = 'Prices cannot be negative.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (extra: Partial<MedicineFormValues> = {}) => {
    setSaving(true);
    setBanner(null);
    const payload: MedicineFormValues = {
      ...form,
      brandName: form.brandName || undefined,
      sku: form.sku || undefined,
      strength: form.strength || undefined,
      controlledSubstanceSchedule: form.controlledSubstanceSchedule || undefined,
      ...extra,
    };
    try {
      if (isEdit) {
        const res = await update.mutateAsync({ id: id!, body: payload });
        navigate(`/medicines/${res.data.id}`);
      } else {
        const res = await create.mutateAsync(payload);
        navigate(`/medicines/${res.data.id}`);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'DUPLICATE_MEDICINE') {
          if (window.confirm('A similar medicine already exists. Create anyway?')) {
            return submit({ ...extra, confirmDuplicate: true });
          }
        } else if (err.code === 'NEGATIVE_MARGIN') {
          if (window.confirm('Selling price is below cost price (negative margin). Save anyway?')) {
            return submit({ ...extra, confirmNegativeMargin: true });
          }
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
    if (!validate()) {
      setBanner('Please fix the highlighted fields.');
      return;
    }
    void submit();
  };

  const addBarcode = () => {
    const v = barcodeInput.trim();
    if (v && !form.barcodes?.includes(v)) set('barcodes', [...(form.barcodes ?? []), v]);
    setBarcodeInput('');
  };

  const inputCls = 'w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';
  const err = (k: string) => errors[k] && <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{errors[k]}</p>;

  if (isEdit && detail.isLoading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{isEdit ? 'Edit Medicine' : 'Add Medicine'}</h1>
        <button type="button" onClick={() => navigate('/medicines')} className="text-sm text-gray-500 underline">Cancel</button>
      </div>

      {banner && <div role="alert" className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{banner}</div>}

      <Section title="Identification">
        <label className="block">
          <span className="text-xs text-gray-500">Generic Name *</span>
          <input className={inputCls} value={form.genericName} onChange={(e) => set('genericName', e.target.value)} />
          {err('genericName')}
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Brand Name</span>
          <input className={inputCls} value={form.brandName ?? ''} onChange={(e) => set('brandName', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">SKU (auto if blank)</span>
          <input className={inputCls} value={form.sku ?? ''} onChange={(e) => set('sku', e.target.value)} placeholder="MED-…" />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Strength</span>
          <input className={inputCls} value={form.strength ?? ''} onChange={(e) => set('strength', e.target.value)} placeholder="500mg" />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Manufacturer *</span>
          <select className={inputCls} value={form.manufacturerId} onChange={(e) => set('manufacturerId', e.target.value)}>
            <option value="">Select…</option>
            {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {err('manufacturerId')}
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Category *</span>
          <select className={inputCls} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">Select…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {err('categoryId')}
        </label>
      </Section>

      <Section title="Clinical / Regulatory">
        <label className="block">
          <span className="text-xs text-gray-500">Dosage Form *</span>
          <select className={inputCls} value={form.dosageFormId} onChange={(e) => set('dosageFormId', e.target.value)}>
            <option value="">Select…</option>
            {dosageForms.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {err('dosageFormId')}
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Storage Condition</span>
          <select className={inputCls} value={form.storageCondition ?? ''} onChange={(e) => set('storageCondition', e.target.value)}>
            {STORAGE_CONDITIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Route of Administration</span>
          <input className={inputCls} value={form.routeOfAdministration ?? ''} onChange={(e) => set('routeOfAdministration', e.target.value)} placeholder="Oral" />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Controlled Schedule (blank = none)</span>
          <input className={inputCls} value={form.controlledSubstanceSchedule ?? ''} onChange={(e) => set('controlledSubstanceSchedule', e.target.value)} placeholder="Schedule II" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!form.prescriptionRequired} onChange={(e) => set('prescriptionRequired', e.target.checked)} />
          Prescription required
          {form.controlledSubstanceSchedule && <span className="text-xs text-amber-600">(forced for controlled substances)</span>}
        </label>
      </Section>

      <Section title="Packaging & Units">
        <label className="block">
          <span className="text-xs text-gray-500">Base Unit *</span>
          <select className={inputCls} value={form.baseUnitId} onChange={(e) => set('baseUnitId', e.target.value)}>
            <option value="">Select…</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          {err('baseUnitId')}
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Purchase Unit *</span>
          <select className={inputCls} value={form.purchaseUnitId} onChange={(e) => set('purchaseUnitId', e.target.value)}>
            <option value="">Select…</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          {err('purchaseUnitId')}
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Sale Unit *</span>
          <select className={inputCls} value={form.saleUnitId} onChange={(e) => set('saleUnitId', e.target.value)}>
            <option value="">Select…</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          {err('saleUnitId')}
        </label>
      </Section>

      <Section title="Pricing & Stock">
        <label className="block">
          <span className="text-xs text-gray-500">Cost Price</span>
          <input type="number" step="0.01" min="0" className={inputCls} value={form.costPrice ?? 0} onChange={(e) => set('costPrice', Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Selling Price</span>
          <input type="number" step="0.01" min="0" className={inputCls} value={form.sellingPrice ?? 0} onChange={(e) => set('sellingPrice', Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">MRP</span>
          <input type="number" step="0.01" min="0" className={inputCls} value={form.mrp ?? 0} onChange={(e) => set('mrp', Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Tax Rate %</span>
          <input type="number" step="0.01" min="0" max="100" className={inputCls} value={form.taxRatePercent ?? 0} onChange={(e) => set('taxRatePercent', Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Reorder Level</span>
          <input type="number" min="0" className={inputCls} value={form.reorderLevel ?? 0} onChange={(e) => set('reorderLevel', Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Opening Stock</span>
          <input type="number" min="0" className={inputCls} value={form.currentStock ?? 0} onChange={(e) => set('currentStock', Number(e.target.value))} disabled={isEdit} />
          {isEdit && <span className="text-[11px] text-gray-400">Stock is managed by Inventory (Module 5).</span>}
        </label>
        {err('pricing')}
      </Section>

      {!isEdit && (
        <Section title="Barcodes">
          <div className="sm:col-span-2">
            <div className="flex gap-2">
              <input className={inputCls} value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBarcode(); } }} placeholder="Scan or type barcode, Enter to add" />
              <button type="button" onClick={addBarcode} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 text-sm">Add</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {form.barcodes?.map((b) => (
                <span key={b} className="inline-flex items-center gap-1 rounded bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs">
                  {b}
                  <button type="button" onClick={() => set('barcodes', form.barcodes?.filter((x) => x !== b))} aria-label={`Remove ${b}`}>×</button>
                </span>
              ))}
            </div>
          </div>
        </Section>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => navigate('/medicines')} className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm">Cancel</button>
        <button type="submit" disabled={saving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create medicine'}
        </button>
      </div>
    </form>
  );
}
