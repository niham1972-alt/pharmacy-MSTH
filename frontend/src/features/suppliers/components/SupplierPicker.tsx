import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { suppliersApi } from '../api/suppliers.api';

/**
 * Reusable active-supplier searchable select. Built in Module 7, consumed by
 * Module 3's PO creation form (excludes archived suppliers). Same shared-
 * component convention as Module 2's MedicineSearchBar / Module 6's
 * ManualBatchOverrideSelector.
 */
export function SupplierPicker({ value, onChange, className }: { value: string; onChange: (id: string) => void; className?: string }) {
  const [term, setTerm] = useState('');
  const { data } = useQuery({ queryKey: ['suppliers', 'active'], queryFn: async () => (await suppliersApi.active()).data, staleTime: 5 * 60_000 });
  const suppliers = data ?? [];
  const selected = suppliers.find((s) => s.id === value);

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    return t ? suppliers.filter((s) => s.companyName.toLowerCase().includes(t)) : suppliers;
  }, [term, suppliers]);

  const inputCls = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';

  if (selected) {
    return (
      <div className={`flex items-center justify-between ${inputCls} ${className ?? ''}`}>
        <span>{selected.companyName}</span>
        <button type="button" onClick={() => onChange('')} className="text-gray-400" aria-label="Clear supplier">✕</button>
      </div>
    );
  }
  return (
    <div className={`relative ${className ?? ''}`}>
      <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search supplier…" className={`${inputCls} block w-full`} />
      {term.trim().length >= 1 && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm shadow-lg">
          {filtered.length === 0 && <li className="px-3 py-1.5 text-gray-400">No active suppliers match.</li>}
          {filtered.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => { onChange(s.id); setTerm(''); }} className="block w-full px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700">{s.companyName}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
