import type { EligibilityLine } from '../types/sales-return.types';

/** Read-only view of ineligible lines with the SPECIFIC reason inline (spec §5/§12). */
export function EligibilityLineItemsTable({ ineligible }: { ineligible: EligibilityLine[] }) {
  if (ineligible.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800">
      <p className="border-b border-gray-100 dark:border-gray-800 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Not returnable</p>
      <ul>
        {ineligible.map((l) => (
          <li key={l.saleItemId} className="flex items-center justify-between gap-3 border-b border-gray-50 dark:border-gray-900 px-3 py-2 last:border-0">
            <span className="text-sm text-gray-700 dark:text-gray-300">{l.name}{l.controlled && <span className="ml-1 rounded bg-red-50 dark:bg-red-950 px-1.5 py-0.5 text-[10px] text-red-600 dark:text-red-400">controlled</span>}</span>
            <span className="text-xs text-red-600 dark:text-red-400">{l.ineligibleReason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
