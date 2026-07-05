import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { ApiClientError } from '../../shared/api/client';
import { customersApi } from '../../features/customers/api/customers.api';

const HEALTH = ['super_admin', 'admin', 'pharmacist'];

export function CustomerFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sp] = useSearchParams();
  const canHealth = HEALTH.includes(user?.role ?? '');

  const [f, setF] = useState({ name: '', phone: '', email: '', dateOfBirth: '', gender: '', nationalIdOrPatientId: '', addressLine1: '', city: '', emergencyContactName: '', emergencyContactPhone: '', consentHealthDataStorage: false, consentMarketingContact: false });
  const [allergyTags, setAllergyTags] = useState('');
  const [conditionTags, setConditionTags] = useState('');
  const [dupWarning, setDupWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch }));

  const { data: existing } = useQuery({ queryKey: ['customers', 'detail', id], queryFn: async () => (await customersApi.detail(id!)).data, enabled: isEdit });
  const { data: health } = useQuery({ queryKey: ['customers', 'health', id], queryFn: async () => (await customersApi.healthProfile(id!)).data, enabled: isEdit && canHealth });
  useEffect(() => {
    if (existing) setF({ name: existing.name, phone: existing.phone, email: existing.email ?? '', dateOfBirth: existing.dateOfBirth?.slice(0, 10) ?? '', gender: existing.gender ?? '', nationalIdOrPatientId: existing.nationalIdOrPatientId ?? '', addressLine1: existing.addressLine1 ?? '', city: existing.city ?? '', emergencyContactName: existing.emergencyContactName ?? '', emergencyContactPhone: existing.emergencyContactPhone ?? '', consentHealthDataStorage: existing.consentHealthDataStorage, consentMarketingContact: existing.consentMarketingContact });
  }, [existing]);
  useEffect(() => { if (health) { setAllergyTags(health.allergyTags.join(', ')); setConditionTags(health.chronicConditionTags.join(', ')); } }, [health]);

  const checkDup = async () => {
    if (!f.phone.trim()) return;
    try { const r = (await customersApi.checkDuplicate({ phone: f.phone.trim(), name: f.name.trim() })).data; setDupWarning(r.hardDuplicate ? `A customer with this phone already exists: ${r.hardDuplicate.name}` : r.softDuplicates.length ? `Possible duplicate: ${r.softDuplicates.map((d) => d.name).join(', ')}` : null); } catch { /* ignore */ }
  };

  const save = async () => {
    setError(null);
    if (f.name.trim().length < 2) return setError('Name is required (min 2 chars).');
    if (!f.phone.trim()) return setError('Phone is required.');
    setSaving(true);
    try {
      const body = { ...f, dateOfBirth: f.dateOfBirth || undefined, email: f.email || undefined };
      let customerId = id;
      if (isEdit) await customersApi.update(id!, body);
      else customerId = (await customersApi.create(body)).data.id;
      // Health info saved via the separate, gated endpoint.
      if (canHealth && (allergyTags.trim() || conditionTags.trim() || (isEdit && health?.exists))) {
        await customersApi.updateHealthProfile(customerId!, { allergyTags: allergyTags.split(',').map((t) => t.trim()).filter(Boolean), chronicConditionTags: conditionTags.split(',').map((t) => t.trim()).filter(Boolean) });
      }
      navigate(`/customers/${customerId}`);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to save customer.');
    } finally {
      setSaving(false);
    }
  };

  const input = 'block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';
  const label = 'text-xs text-gray-500';

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{isEdit ? 'Edit Customer' : 'New Customer'}</h1>
        <button onClick={() => navigate('/customers')} className="text-sm text-gray-500 underline">Cancel</button>
      </div>
      {error && <div role="alert" className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {dupWarning && <div className="mb-3 rounded-md border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950 px-3 py-2 text-sm text-orange-700 dark:text-orange-300">⚠ {dupWarning}</div>}

      <section className="mb-4 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Basic Info</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label><span className={label}>Name *</span><input value={f.name} onChange={(e) => set({ name: e.target.value })} className={input} /></label>
          <label><span className={label}>Phone *</span><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} onBlur={checkDup} className={input} /></label>
          <label><span className={label}>Email</span><input value={f.email} onChange={(e) => set({ email: e.target.value })} className={input} /></label>
          <label><span className={label}>Date of Birth</span><input type="date" value={f.dateOfBirth} onChange={(e) => set({ dateOfBirth: e.target.value })} className={input} /></label>
          <label><span className={label}>Gender</span><input value={f.gender} onChange={(e) => set({ gender: e.target.value })} className={input} /></label>
          <label><span className={label}>National / Patient ID</span><input value={f.nationalIdOrPatientId} onChange={(e) => set({ nationalIdOrPatientId: e.target.value })} className={input} /></label>
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Contact &amp; Emergency</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label><span className={label}>Address</span><input value={f.addressLine1} onChange={(e) => set({ addressLine1: e.target.value })} className={input} /></label>
          <label><span className={label}>City</span><input value={f.city} onChange={(e) => set({ city: e.target.value })} className={input} /></label>
          <label><span className={label}>Emergency contact name</span><input value={f.emergencyContactName} onChange={(e) => set({ emergencyContactName: e.target.value })} className={input} /></label>
          <label><span className={label}>Emergency contact phone</span><input value={f.emergencyContactPhone} onChange={(e) => set({ emergencyContactPhone: e.target.value })} className={input} /></label>
        </div>
        <div className="mt-3 flex gap-4 text-sm">
          <label className="flex items-center gap-1"><input type="checkbox" checked={f.consentHealthDataStorage} onChange={(e) => set({ consentHealthDataStorage: e.target.checked })} />Consent: store health data</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={f.consentMarketingContact} onChange={(e) => set({ consentMarketingContact: e.target.checked })} />Consent: marketing contact</label>
        </div>
      </section>

      {canHealth && (
        <section id="health" className={`mb-4 rounded-lg border p-4 ${sp.get('health') ? 'border-rose-300 dark:border-rose-800' : 'border-gray-200 dark:border-gray-800'}`}>
          <h2 className="mb-1 text-sm font-semibold text-rose-700 dark:text-rose-400">🔒 Health Information</h2>
          <p className="mb-3 text-xs text-gray-500">Sensitive — access &amp; changes are audit-logged. Comma-separate tags.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label><span className={label}>Allergy tags</span><input value={allergyTags} onChange={(e) => setAllergyTags(e.target.value)} placeholder="Penicillin, Sulfa" className={input} /></label>
            <label><span className={label}>Chronic condition tags</span><input value={conditionTags} onChange={(e) => setConditionTags(e.target.value)} placeholder="Diabetes Type 2, Hypertension" className={input} /></label>
          </div>
        </section>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={() => navigate('/customers')} className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm">Cancel</button>
        <button onClick={save} disabled={saving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Customer'}</button>
      </div>
    </div>
  );
}
