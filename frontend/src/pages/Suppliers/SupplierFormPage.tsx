import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiClientError } from '../../shared/api/client';
import { suppliersApi, PAYMENT_TERMS, SUPPLIER_TYPES, SupplierType } from '../../features/suppliers/api/suppliers.api';

interface ContactRow { name: string; designation: string; phone: string; email: string; isPrimary: boolean }

export function SupplierFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [tradingName, setTradingName] = useState('');
  const [supplierType, setSupplierType] = useState<SupplierType>('DISTRIBUTOR');
  const [taxRegistrationNumber, setTax] = useState('');
  const [drugLicenseNumber, setLicense] = useState('');
  const [drugLicenseExpiry, setLicenseExpiry] = useState('');
  const [paymentTermsCode, setTerms] = useState('NET_30');
  const [notes, setNotes] = useState('');
  const [contacts, setContacts] = useState<ContactRow[]>([{ name: '', designation: '', phone: '', email: '', isPrimary: true }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: existing } = useQuery({ queryKey: ['suppliers', 'detail', id], queryFn: async () => (await suppliersApi.detail(id!)).data, enabled: isEdit });
  useEffect(() => {
    if (!existing) return;
    setCompanyName(existing.companyName); setTradingName(existing.tradingName ?? ''); setSupplierType(existing.supplierType);
    setTax(existing.taxRegistrationNumber ?? ''); setLicense(existing.drugLicenseNumber ?? ''); setLicenseExpiry(existing.drugLicenseExpiry?.slice(0, 10) ?? '');
    setTerms(existing.paymentTermsCode); setNotes(existing.notes ?? '');
  }, [existing]);

  const updateContact = (i: number, patch: Partial<ContactRow>) => setContacts((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : idx !== i && patch.isPrimary ? { ...c, isPrimary: false } : c)));
  const addContact = () => setContacts((cs) => [...cs, { name: '', designation: '', phone: '', email: '', isPrimary: cs.length === 0 }]);
  const removeContact = (i: number) => setContacts((cs) => cs.filter((_, idx) => idx !== i));

  const save = async () => {
    setError(null);
    if (companyName.trim().length < 2) return setError('Company name is required (min 2 chars).');
    const cleanContacts = contacts.filter((c) => c.name.trim());
    for (const c of cleanContacts) if (!c.phone.trim() && !c.email.trim()) return setError(`Contact "${c.name}" needs a phone or email.`);
    setSaving(true);
    try {
      const body = {
        companyName: companyName.trim(), tradingName: tradingName || undefined, supplierType, taxRegistrationNumber: taxRegistrationNumber || undefined,
        drugLicenseNumber: drugLicenseNumber || undefined, drugLicenseExpiry: drugLicenseExpiry || undefined, paymentTermsCode, notes: notes || undefined,
      };
      if (isEdit) {
        await suppliersApi.update(id!, body);
        navigate(`/suppliers/${id}`);
      } else {
        const res = await suppliersApi.create({ ...body, contacts: cleanContacts.map((c) => ({ name: c.name, designation: c.designation || undefined, phone: c.phone || undefined, email: c.email || undefined, isPrimary: c.isPrimary })) });
        navigate(`/suppliers/${res.data.id}`);
      }
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to save supplier.');
    } finally {
      setSaving(false);
    }
  };

  const input = 'block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';
  const label = 'text-xs text-gray-500';

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{isEdit ? 'Edit Supplier' : 'New Supplier'}</h1>
        <button onClick={() => navigate('/suppliers')} className="text-sm text-gray-500 underline">Cancel</button>
      </div>
      {error && <div role="alert" className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <section className="mb-4 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Company Info</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label><span className={label}>Company Name *</span><input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={input} /></label>
          <label><span className={label}>Trading Name</span><input value={tradingName} onChange={(e) => setTradingName(e.target.value)} className={input} /></label>
          <label><span className={label}>Type *</span><select value={supplierType} onChange={(e) => setSupplierType(e.target.value as SupplierType)} className={input}>{SUPPLIER_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></label>
          <label><span className={label}>Payment Terms *</span><select value={paymentTermsCode} onChange={(e) => setTerms(e.target.value)} className={input}>{PAYMENT_TERMS.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}</select></label>
          <label><span className={label}>Tax Registration No.</span><input value={taxRegistrationNumber} onChange={(e) => setTax(e.target.value)} className={input} /></label>
          <label><span className={label}>Drug License No.</span><input value={drugLicenseNumber} onChange={(e) => setLicense(e.target.value)} className={input} /></label>
          <label><span className={label}>Drug License Expiry</span><input type="date" value={drugLicenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} className={input} /></label>
          <label className="sm:col-span-2"><span className={label}>Notes</span><input value={notes} onChange={(e) => setNotes(e.target.value)} className={input} /></label>
        </div>
      </section>

      {!isEdit && (
        <section className="mb-4 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Contacts</h2><button onClick={addContact} className="text-sm text-brand-600 underline">+ Add contact</button></div>
          {contacts.map((c, i) => (
            <div key={i} className="mb-2 grid grid-cols-1 gap-2 rounded-md border border-gray-100 dark:border-gray-800 p-2 sm:grid-cols-5">
              <input value={c.name} onChange={(e) => updateContact(i, { name: e.target.value })} placeholder="Name" className={input} />
              <input value={c.designation} onChange={(e) => updateContact(i, { designation: e.target.value })} placeholder="Role" className={input} />
              <input value={c.phone} onChange={(e) => updateContact(i, { phone: e.target.value })} placeholder="Phone" className={input} />
              <input value={c.email} onChange={(e) => updateContact(i, { email: e.target.value })} placeholder="Email" className={input} />
              <div className="flex items-center gap-2 text-xs"><label className="flex items-center gap-1"><input type="radio" name="primary" checked={c.isPrimary} onChange={() => updateContact(i, { isPrimary: true })} />Primary</label>{contacts.length > 1 && <button onClick={() => removeContact(i)} className="text-red-500">✕</button>}</div>
            </div>
          ))}
        </section>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={() => navigate('/suppliers')} className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm">Cancel</button>
        <button onClick={save} disabled={saving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Supplier'}</button>
      </div>
    </div>
  );
}
