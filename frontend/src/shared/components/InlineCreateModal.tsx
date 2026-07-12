import { FormEvent, useState } from 'react';

/**
 * A tiny single-field (+ optional extras) create modal, used for inline quick-add
 * of a Supplier or Rack from the GRN screen without leaving the page. `onCreate`
 * returns the created record; the caller selects it.
 */
export function InlineCreateModal({
  title,
  label,
  placeholder,
  extraFields = [],
  onCreate,
  onClose,
}: {
  title: string;
  label: string;
  placeholder?: string;
  extraFields?: Array<{ key: string; label: string; placeholder?: string }>;
  onCreate: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!values.name?.trim()) { setError(`${label} is required.`); return; }
    setBusy(true);
    setError(null);
    try {
      await onCreate(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg bg-white dark:bg-gray-900 p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">✕</button>
        </div>
        {error && <div role="alert" className="mb-2 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-1.5 text-sm text-red-700 dark:text-red-300">{error}</div>}
        <label className="block"><span className="text-xs text-gray-500">{label} *</span>
          <input autoFocus className={input} placeholder={placeholder} value={values.name ?? ''} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />
        </label>
        {extraFields.map((f) => (
          <label key={f.key} className="mt-2 block"><span className="text-xs text-gray-500">{f.label}</span>
            <input className={input} placeholder={f.placeholder} value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
          </label>
        ))}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy ? 'Saving…' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}
