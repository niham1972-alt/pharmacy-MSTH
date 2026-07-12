import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { useDashboardFilters } from '../../shared/store/dashboardFilters';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { usePurchaseOrders, useSuppliers } from '../../features/purchases/hooks/usePurchases';
import { POStatusBadge, PaymentStatusBadge } from '../../features/purchases/components/badges';

const CAN_MANAGE = ['super_admin', 'admin', 'inventory_manager'];
const CAN_APPROVE = ['super_admin', 'admin'];

const STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'REJECTED'];

export function PurchaseOrdersListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const branchId = useDashboardFilters((s) => s.branchId);
  const { data: suppliers } = useSuppliers();

  const [status, setStatus] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const canManage = CAN_MANAGE.includes(user?.role ?? '');
  const canApprove = CAN_APPROVE.includes(user?.role ?? '');

  const { data, isLoading, isError, refetch } = usePurchaseOrders({ page, limit: 15, status: status || undefined, supplierId: supplierId || undefined, search: search || undefined, branchId });
  const rows = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Purchase Orders</h1>
        <div className="flex gap-2">
          {canApprove && (
            <Link to="/purchases/approvals" className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Pending Approvals</Link>
          )}
          {canManage && (
            <>
              <Link to="/purchases/receive" className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">+ Add New Stock</Link>
              <Link to="/purchases/new" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">+ New PO</Link>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search PO# or supplier…" aria-label="Search" className="w-64 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm" />
        <select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setPage(1); }} aria-label="Supplier" className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm">
          <option value="">All suppliers</option>
          {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status" className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm">
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">PO #</th>
              <th className="px-3 py-2">Supplier</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Items</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Payment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="animate-pulse"><td colSpan={7} className="px-3 py-3"><div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800" /></td></tr>
            ))}
            {isError && <tr><td colSpan={7} className="px-3 py-8 text-center"><p className="text-sm text-red-600">Couldn't load purchase orders.</p><button onClick={() => refetch()} className="mt-1 text-sm underline">Retry</button></td></tr>}
            {!isLoading && !isError && rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-500">
                No purchase orders yet.{canManage && <> <Link to="/purchases/new" className="text-brand-600 underline">Create your first PO</Link> or <Link to="/purchases/receive" className="text-brand-600 underline">receive goods directly</Link>.</>}
              </td></tr>
            )}
            {rows.map((po) => (
              <tr key={po.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40" onClick={() => navigate(`/purchases/${po.id}`)}>
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{po.poNumber}{po.isDirectGrn && <span className="ml-1 text-xs text-gray-400">(direct)</span>}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{po.supplier.name}</td>
                <td className="px-3 py-2 text-gray-500">{new Date(po.orderDate).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-gray-500">{po.itemCount}</td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(po.grandTotal)}</td>
                <td className="px-3 py-2"><POStatusBadge status={po.status} /></td>
                <td className="px-3 py-2"><PaymentStatusBadge status={po.paymentStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>{meta.total} orders · page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 disabled:opacity-40">Prev</button>
            <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
