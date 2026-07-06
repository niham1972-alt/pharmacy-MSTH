import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { batchesApi } from '../../features/batches/api/batches.api';
import { BatchStatusBadge, ExpiryChip } from '../../features/batches/components/BatchStatusBadge';
import { RecallFlagModal } from '../../features/batches/components/RecallFlagModal';
import { WriteOffModal } from '../../features/batches/components/WriteOffModal';
import { AuditTrailTab } from '../../features/audit-logs/components/AuditTrailTab';

const CAN_RECALL = ['super_admin', 'admin', 'pharmacist'];
const CAN_WRITE_OFF = ['super_admin', 'admin', 'inventory_manager'];

export function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showRecall, setShowRecall] = useState(false);
  const [showWriteOff, setShowWriteOff] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['batches', 'detail', id], queryFn: async () => (await batchesApi.detail(id!)).data, enabled: !!id });

  if (isLoading) return <div className="animate-pulse text-gray-400">Loading batch…</div>;
  if (isError || !data) return <div className="text-red-600">Couldn't load batch. <button onClick={() => refetch()} className="underline">Retry</button></div>;

  const canSeeCost = user?.role !== 'cashier';
  const sellable = !data.isRecalled && data.status !== 'EXPIRED' && data.currentQuantity > 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-2 text-sm text-gray-500"><Link to="/batches" className="underline">Batches</Link> / {data.batchNumber}</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{data.medicineName}</h1>
          <div className="mt-1 flex items-center gap-2"><span className="text-sm text-gray-500">Batch {data.batchNumber}</span><BatchStatusBadge batch={data} /></div>
        </div>
        <div className="flex gap-2">
          {CAN_RECALL.includes(user?.role ?? '') && !data.isRecalled && <button onClick={() => setShowRecall(true)} className="rounded-md border border-purple-300 dark:border-purple-800 px-3 py-1.5 text-sm text-purple-700 dark:text-purple-400">Flag Recall</button>}
          {CAN_WRITE_OFF.includes(user?.role ?? '') && data.currentQuantity > 0 && <button onClick={() => setShowWriteOff(true)} className="rounded-md border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm text-red-700 dark:text-red-400">Write Off</button>}
        </div>
      </div>

      {!sellable && data.currentQuantity > 0 && (
        <div className="mb-4 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          ⛔ This batch is <strong>blocked from sale</strong> ({data.isRecalled ? 'recalled' : 'expired'}) — {data.currentQuantity} units cannot be dispensed.
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Current Qty', String(data.currentQuantity)],
          ['Received Qty', String(data.receivedQuantity)],
          ['Expiry', `${new Date(data.expiryDate).toLocaleDateString()}`],
          ...(canSeeCost ? [['Unit Cost', formatCurrency(data.unitCostAtReceipt)] as [string, string]] : []),
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-800 p-4 text-sm">
        <div className="flex flex-wrap gap-x-8 gap-y-1">
          <span className="text-gray-500">Days to expiry: <ExpiryChip daysToExpiry={data.daysToExpiry} tier={data.tier} /></span>
          {data.manufactureDate && <span className="text-gray-500">Mfg: {new Date(data.manufactureDate).toLocaleDateString()}</span>}
          {data.sourceGrnId && <span className="text-gray-500">Source GRN: <Link className="underline" to={`/purchases/receive`}>{data.sourceGrnId.slice(0, 8)}…</Link></span>}
          {data.expiryOverridden && <span className="text-orange-600">Expiry overridden: {data.expiryOverrideReason}</span>}
        </div>
      </div>

      {/* Traceability: sales that consumed this batch */}
      <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Linked sales ({data.linkedSales.length})</h2>
      <div className="mb-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Sale</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Qty</th></tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.linkedSales.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">No sales have drawn from this batch yet.</td></tr>}
            {data.linkedSales.map((s) => (
              <tr key={s.saleId}><td className="px-3 py-2"><Link to={`/sales/${s.saleId}`} className="underline">{s.saleNumber}</Link></td><td className="px-3 py-2 text-gray-500">{new Date(s.saleDate).toLocaleDateString()}</td><td className="px-3 py-2">{s.status}</td><td className="px-3 py-2 text-right">{s.quantity}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {(data.writeOffs.length > 0 || data.recalls.length > 0) && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 text-sm">
          {data.recalls.map((r) => <p key={r.id} className="text-purple-700 dark:text-purple-400">🚩 Recalled {new Date(r.flaggedAt).toLocaleDateString()} — {r.reason} ({r.resolutionStatus})</p>)}
          {data.writeOffs.map((w) => <p key={w.id} className="text-red-700 dark:text-red-400">🗑 Wrote off {w.quantity} — {w.disposalMethod} {w.disposalReference ? `(${w.disposalReference})` : ''} on {new Date(w.writtenOffAt).toLocaleDateString()}</p>)}
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Audit Trail</h2>
        <AuditTrailTab entityType="MEDICINE_BATCH" entityId={data.id} />
      </div>

      {showRecall && <RecallFlagModal batch={data} onClose={() => setShowRecall(false)} onDone={() => { setShowRecall(false); refetch(); }} />}
      {showWriteOff && <WriteOffModal batches={[data]} onClose={() => setShowWriteOff(false)} onDone={() => { setShowWriteOff(false); refetch(); }} />}
    </div>
  );
}
