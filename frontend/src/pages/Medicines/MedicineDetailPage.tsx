import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { useMedicineDetail, useMedicineMutations, usePriceHistory } from '../../features/medicines/hooks/useMedicines';
import { StatusBadge, StockStatusBadge } from '../../features/medicines/components/StockStatusBadge';
import { AuditTrailTab } from '../../features/audit-logs/components/AuditTrailTab';

const CAN_EDIT = ['super_admin', 'admin', 'pharmacist', 'inventory_manager'];
const CAN_MANAGE = ['super_admin', 'admin', 'inventory_manager'];
const CAN_DELETE = ['super_admin', 'admin'];

type Tab = 'overview' | 'pricing' | 'history' | 'barcodes' | 'audit';

export function MedicineDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useMedicineDetail(id);
  const { changeStatus, archive, remove } = useMedicineMutations();
  const [tab, setTab] = useState<Tab>('overview');

  const canEdit = CAN_EDIT.includes(user?.role ?? '');
  const canManage = CAN_MANAGE.includes(user?.role ?? '');
  const canDelete = CAN_DELETE.includes(user?.role ?? '');
  const canSeeCost = user?.role !== 'cashier';
  const canSeeHistory = user?.role !== 'cashier';
  const canSeeAudit = ['super_admin', 'admin', 'pharmacist', 'inventory_manager', 'auditor'].includes(user?.role ?? '');

  const history = usePriceHistory(id, tab === 'history' && canSeeHistory);

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (isError || !data) {
    return (
      <div className="text-center">
        <p className="text-sm text-red-600 dark:text-red-400">Couldn't load medicine.</p>
        <button onClick={() => refetch()} className="mt-1 text-sm underline">Retry</button>
      </div>
    );
  }

  const onStatus = async (status: string) => {
    await changeStatus.mutateAsync({ id: data.id, status });
    refetch();
  };
  const onArchive = async () => {
    if (window.confirm('Archive this medicine? It will be hidden but kept in history.')) {
      await archive.mutateAsync(data.id);
      refetch();
    }
  };
  const onDelete = async () => {
    if (!window.confirm('Permanently delete this medicine? Only possible if it has no sales/batch history.')) return;
    try {
      await remove.mutateAsync(data.id);
      navigate('/medicines');
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const tabs: Array<[Tab, string]> = [
    ['overview', 'Overview'],
    ['pricing', 'Pricing'],
    ...(canSeeHistory ? ([['history', 'Price History']] as Array<[Tab, string]>) : []),
    ['barcodes', 'Barcodes'],
    ...(canSeeAudit ? ([['audit', 'Audit Trail']] as Array<[Tab, string]>) : []),
  ];

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 dark:text-gray-100 text-right">{value ?? '—'}</span>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
        <Link to="/medicines" className="underline">Medicines</Link> <span>/</span> <span>{data.name}</span>
      </div>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {data.name} {data.strength && <span className="text-gray-400">· {data.strength}</span>}
          </h1>
          <p className="text-sm text-gray-500">{data.genericName} · {data.sku} · {data.manufacturer.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={data.status} />
            <StockStatusBadge status={data.stockStatus} count={data.currentStock} />
            {data.prescriptionRequired && <span className="rounded bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 text-xs text-purple-800 dark:text-purple-300">℞ Prescription</span>}
            {data.controlledSubstanceSchedule && <span className="rounded bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs text-red-800 dark:text-red-300">Controlled: {data.controlledSubstanceSchedule}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <Link to={`/medicines/${data.id}/edit`} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Edit</Link>}
          {canManage && data.status !== 'DISCONTINUED' && <button onClick={() => onStatus('DISCONTINUED')} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Discontinue</button>}
          {canManage && data.status !== 'ACTIVE' && <button onClick={() => onStatus('ACTIVE')} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Reactivate</button>}
          {canManage && data.isActive && <button onClick={onArchive} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Archive</button>}
          {canDelete && <button onClick={onDelete} className="rounded-md border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm text-red-600 dark:text-red-400">Delete</button>}
        </div>
      </div>

      <div role="tablist" className="mb-4 flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {tabs.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm ${tab === key ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400 font-medium' : 'text-gray-500'}`}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><Row label="Category" value={data.category.name} /><Row label="Dosage Form" value={data.dosageForm.name} /><Row label="Route" value={data.routeOfAdministration} /><Row label="Therapeutic Class" value={data.therapeuticClass} /><Row label="Storage" value={data.storageCondition} /></div>
          <div><Row label="Base Unit" value={data.baseUnit.name} /><Row label="Purchase Unit" value={data.purchaseUnit.name} /><Row label="Sale Unit" value={data.saleUnit.name} /><Row label="Current Stock" value={data.currentStock} /><Row label="Reorder Level" value={data.reorderLevel} /></div>
        </div>
      )}

      {tab === 'pricing' && (
        <div className="max-w-sm">
          {canSeeCost && <Row label="Cost Price" value={formatCurrency(data.costPrice ?? 0)} />}
          <Row label="Selling Price" value={formatCurrency(data.sellingPrice)} />
          <Row label="MRP" value={formatCurrency(data.mrp)} />
          <Row label="Tax Rate" value={`${data.taxRatePercent}%`} />
          <Row label="Tax Inclusive" value={data.taxInclusive ? 'Yes' : 'No'} />
          {canSeeCost && <Row label="Margin" value={data.margin != null ? `${data.margin}%` : '—'} />}
        </div>
      )}

      {tab === 'history' && canSeeHistory && (
        <div>
          {history.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {history.data && history.data.length === 0 && <p className="text-sm text-gray-500">No price changes recorded.</p>}
          {history.data && history.data.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500"><tr><th className="py-1">Type</th><th>Old</th><th>New</th><th>When</th><th>Reason</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {history.data.map((h) => (
                  <tr key={h.id}><td className="py-1.5">{h.priceType}</td><td>{formatCurrency(h.oldValue)}</td><td>{formatCurrency(h.newValue)}</td><td className="text-gray-500">{new Date(h.effectiveAt).toLocaleDateString()}</td><td className="text-gray-500">{h.reason ?? '—'}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'barcodes' && (
        <div className="flex flex-wrap gap-2">
          {data.barcodes.length === 0 && <p className="text-sm text-gray-500">No barcodes assigned.</p>}
          {data.barcodes.map((b) => (
            <span key={b.id} className="rounded bg-gray-100 dark:bg-gray-800 px-3 py-1 text-sm font-mono">{b.barcode}{b.isPrimary && <span className="ml-1 text-xs text-brand-600">primary</span>}</span>
          ))}
        </div>
      )}

      {tab === 'audit' && canSeeAudit && <AuditTrailTab entityType="MEDICINE" entityId={id!} />}
    </div>
  );
}
