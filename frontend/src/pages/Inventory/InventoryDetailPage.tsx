import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { StockStatusBadge } from '../../features/medicines/components/StockStatusBadge';
import { inventoryApi } from '../../features/inventory/api/inventory.api';

type Tab = 'overview' | 'batches' | 'ledger';
const REASON_LABEL: Record<string, string> = { PURCHASE_RECEIPT: 'Purchase receipt', SALE: 'Sale', OPENING_STOCK: 'Opening stock', POSITIVE_ADJUSTMENT: 'Adjustment (+)', NEGATIVE_ADJUSTMENT: 'Adjustment (−)', TRANSFER_IN: 'Transfer in', TRANSFER_OUT: 'Transfer out', SALES_RETURN: 'Sales return', PURCHASE_RETURN: 'Purchase return', EXPIRY_WRITE_OFF: 'Expiry write-off', DAMAGE_WRITE_OFF: 'Damage write-off' };

function refLink(module: string, id: string): string | null {
  if (module === 'SALE') return `/sales/${id}`;
  if (module === 'PURCHASE') return `/purchases/${id}`; // GRN references its PO id path via detail
  return null;
}

export function InventoryDetailPage() {
  const { medicineId } = useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const canSeeCost = user?.role !== 'cashier';
  const canSeeLedger = user?.role !== 'cashier';

  const detail = useQuery({ queryKey: ['inventory', 'detail', medicineId], queryFn: async () => (await inventoryApi.detail(medicineId!)).data, enabled: !!medicineId });
  const ledger = useQuery({ queryKey: ['inventory', 'ledger', medicineId], queryFn: async () => (await inventoryApi.ledger(medicineId!)).data, enabled: !!medicineId && tab === 'ledger' && canSeeLedger });

  if (detail.isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (detail.isError || !detail.data) return <div className="text-center"><p className="text-sm text-red-600">Couldn't load stock detail.</p><button onClick={() => detail.refetch()} className="mt-1 text-sm underline">Retry</button></div>;
  const d = detail.data;

  const tabs: Array<[Tab, string]> = [['overview', 'Overview'], ['batches', `Batches (${d.batches.length})`], ...(canSeeLedger ? ([['ledger', 'Movement History']] as Array<[Tab, string]>) : [])];
  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 py-1.5 text-sm"><span className="text-gray-500">{label}</span><span className="text-gray-900 dark:text-gray-100">{value}</span></div>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 text-sm text-gray-500"><Link to="/inventory" className="underline">Inventory</Link> / {d.name}</div>
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{d.name}</h1>
        <StockStatusBadge status={d.stockStatus} count={d.currentStock} />
      </div>

      <div role="tablist" className="mb-3 flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-3 py-2 text-sm ${tab === k ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400 font-medium' : 'text-gray-500'}`}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="max-w-md">
          <Row label="Current Stock" value={d.currentStock} />
          <Row label="Reorder Level" value={d.reorderLevel} />
          <Row label="Reorder Quantity" value={d.reorderQuantity} />
          {canSeeCost && <Row label="Unit Cost" value={formatCurrency(d.unitCost ?? 0)} />}
          {canSeeCost && <Row label="Stock Value" value={formatCurrency(d.stockValue ?? 0)} />}
        </div>
      )}

      {tab === 'batches' && (
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-gray-500"><tr><th className="py-1">Batch</th><th>Qty</th><th>Expiry</th></tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {d.batches.length === 0 && <tr><td colSpan={3} className="py-4 text-gray-500">No active batches.</td></tr>}
            {d.batches.map((b) => (
              <tr key={b.id}><td className="py-1.5 font-mono">{b.batchNumber}</td><td>{b.quantity}</td><td className="text-gray-500">{new Date(b.expiryDate).toLocaleDateString()}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'ledger' && canSeeLedger && (
        <div>
          {ledger.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {ledger.data && ledger.data.length === 0 && <p className="text-sm text-gray-500">No stock movements yet.</p>}
          {ledger.data && ledger.data.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500"><tr><th className="py-1">Date</th><th>Type</th><th>Qty</th><th>Reason</th><th>Reference</th><th>Balance</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {ledger.data.map((e) => {
                  const link = refLink(e.referenceModule, e.referenceId);
                  return (
                    <tr key={e.id}>
                      <td className="py-1.5 text-gray-500">{new Date(e.createdAt).toLocaleDateString()}</td>
                      <td><span className={e.direction === 'IN' ? 'text-green-600' : 'text-red-600'}>{e.direction === 'IN' ? '▲ IN' : '▼ OUT'}</span></td>
                      <td>{e.quantity}</td>
                      <td className="text-gray-600 dark:text-gray-400">{REASON_LABEL[e.reasonCode] ?? e.reasonCode}</td>
                      <td className="text-gray-500">{link ? <Link to={link} className="text-brand-600 dark:text-brand-400 underline">{e.referenceModule}</Link> : e.referenceModule}</td>
                      <td className="font-medium">{e.balanceAfter}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
