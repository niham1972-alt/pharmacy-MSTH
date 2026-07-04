import { Link } from 'react-router-dom';
import { useDashboardFilters } from '../../shared/store/dashboardFilters';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { usePendingApprovals, usePurchaseMutations } from '../../features/purchases/hooks/usePurchases';

export function PendingApprovalsPage() {
  const branchId = useDashboardFilters((s) => s.branchId);
  const { data, isLoading, refetch } = usePendingApprovals(branchId);
  const { approve, reject } = usePurchaseMutations();

  const onApprove = async (id: string) => { await approve.mutateAsync(id); refetch(); };
  const onReject = async (id: string) => { const r = window.prompt('Reason for rejection?'); if (r) { await reject.mutateAsync({ id, reason: r }); refetch(); } };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 text-sm text-gray-500"><Link to="/purchases" className="underline">Purchases</Link> / Pending Approvals</div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Pending Approvals</h1>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {data && data.length === 0 && <p className="rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-8 text-center text-gray-500">No pending approvals — you're all caught up. ✓</p>}

      <div className="space-y-2">
        {data?.map((po) => (
          <div key={po.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3">
            <div>
              <Link to={`/purchases/${po.id}`} className="font-medium text-brand-700 dark:text-brand-400 underline">{po.poNumber}</Link>
              <span className="ml-2 text-sm text-gray-500">{po.supplierName} · {po.itemCount} item(s) · {formatCurrency(po.grandTotal)}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onApprove(po.id)} className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white">Approve</button>
              <button onClick={() => onReject(po.id)} className="rounded-md border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm text-red-600">Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
