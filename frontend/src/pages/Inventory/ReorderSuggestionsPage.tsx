import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useDashboardFilters } from '../../shared/store/dashboardFilters';
import { inventoryApi } from '../../features/inventory/api/inventory.api';

export function ReorderSuggestionsPage() {
  const navigate = useNavigate();
  const branchId = useDashboardFilters((s) => s.branchId);
  const { data, isLoading } = useQuery({ queryKey: ['inventory', 'reorder', branchId], queryFn: async () => (await inventoryApi.reorderSuggestions(branchId)).data });
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const rows = data ?? [];
  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const chosen = rows.filter((r) => selected[r.medicineId]);

  const createPo = () => {
    // Deep-link into Module 3's PO form, pre-filled with the selected items.
    navigate('/purchases/new', { state: { prefill: chosen.map((r) => ({ medicineId: r.medicineId, name: r.name, orderedQuantity: r.suggestedQuantity })) } });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 text-sm text-gray-500"><Link to="/inventory" className="underline">Inventory</Link> / Reorder Suggestions</div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Reorder Suggestions</h1>
        <button onClick={createPo} disabled={chosen.length === 0} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">Create Purchase Order ({chosen.length})</button>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {data && data.length === 0 && <p className="rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-8 text-center text-gray-500">No low-stock items — you're well stocked! ✓</p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
              <tr><th className="px-3 py-2"></th><th className="px-3 py-2">Medicine</th><th className="px-3 py-2 text-right">Current</th><th className="px-3 py-2 text-right">Reorder at</th><th className="px-3 py-2 text-right">Suggested Qty</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((r) => (
                <tr key={r.medicineId} className={selected[r.medicineId] ? 'bg-brand-50 dark:bg-brand-900/10' : ''}>
                  <td className="px-3 py-2"><input type="checkbox" checked={!!selected[r.medicineId]} onChange={() => toggle(r.medicineId)} aria-label={`Select ${r.name}`} /></td>
                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{r.name}<span className="block text-xs text-gray-400">{r.sku}</span></td>
                  <td className={`px-3 py-2 text-right ${r.currentStock === 0 ? 'text-red-600 font-medium' : 'text-orange-600'}`}>{r.currentStock}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{r.reorderLevel}</td>
                  <td className="px-3 py-2 text-right font-medium">{r.suggestedQuantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
