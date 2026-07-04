import { useState } from 'react';
import { useMedicineSearch } from '../../medicines/hooks/useMedicines';

/** Typeahead medicine picker reused across PO/GRN line editors (spec §9). */
export function MedicinePicker({ onSelect }: { onSelect: (m: { id: string; name: string; costPrice?: number }) => void }) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const { data, isFetching } = useMedicineSearch(term);

  return (
    <div className="relative">
      <input
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search medicine to add…"
        aria-label="Search medicine"
        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
      />
      {open && term.trim().length >= 2 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg text-sm">
          {isFetching && <li className="px-3 py-2 text-gray-400">Searching…</li>}
          {data && data.length === 0 && !isFetching && <li className="px-3 py-2 text-gray-400">No matches</li>}
          {data?.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect({ id: m.id, name: m.name, costPrice: m.costPrice });
                  setTerm('');
                  setOpen(false);
                }}
                className="block w-full px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="font-medium">{m.name}</span> <span className="text-gray-400">· {m.sku} · stock {m.currentStock}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
