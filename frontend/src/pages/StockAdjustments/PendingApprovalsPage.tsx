import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { ApiClientError } from '../../shared/api/client';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { stockAdjustmentsApi } from '../../features/stock-adjustments/api/stock-adjustments.api';
import { REASON_LABELS } from '../../features/stock-adjustments/types/stock-adjustment.types';
import { StepUpAuthModal } from '../../features/users/components/StepUpAuthModal';

export function PendingApprovalsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [stepUpFor, setStepUpFor] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['adjustments', 'pending'], queryFn: async () => (await stockAdjustmentsApi.pending()).data });
  const refresh = () => qc.invalidateQueries({ queryKey: ['adjustments'] });

  const doApprove = async (id: string) => {
    setBanner(null);
    try { await stockAdjustmentsApi.approve(id); refresh(); setBanner('Adjustment approved — stock updated.'); }
    catch (e) { setBanner(e instanceof ApiClientError ? e.message : 'Approval failed.'); }
  };

  const doReject = async (id: string) => {
    const reason = window.prompt('Reason for rejection (retained on the record):');
    if (!reason?.trim()) return;
    setBanner(null);
    try { await stockAdjustmentsApi.reject(id, reason.trim()); refresh(); setBanner('Adjustment rejected — no stock change.'); }
    catch (e) { setBanner(e instanceof ApiClientError ? e.message : 'Rejection failed.'); }
  };

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-gray-900 dark:text-gray-100">Pending Adjustment Approvals</h1>
      <p className="mb-4 text-sm text-gray-500">Above-threshold adjustments awaiting a second admin's review. You cannot approve your own request — a genuine two-person check.</p>
      {banner && <div className="mb-3 rounded-md border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950 px-3 py-2 text-sm text-indigo-700 dark:text-indigo-300">{banner}</div>}

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">ADJ #</th><th className="px-3 py-2">Medicine</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Reason</th><th className="px-3 py-2 text-right">Value</th><th className="px-3 py-2">Requested</th><th className="px-3 py-2 text-right">Action</th></tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">Loading…</td></tr>}
            {!isLoading && data?.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">No pending approvals — all caught up.</td></tr>}
            {data?.map((a) => {
              const isOwn = a.requestedBy === user?.userId;
              return (
                <tr key={a.id}>
                  <td className="px-3 py-2"><Link to={`/stock-adjustments/${a.id}`} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">{a.adjustmentNumber}</Link></td>
                  <td className="px-3 py-2">{a.medicineName}</td>
                  <td className="px-3 py-2"><span className={a.direction === 'DECREASE' ? 'text-red-600' : 'text-green-600'}>{a.direction === 'DECREASE' ? '−' : '+'}{a.quantity}</span></td>
                  <td className="px-3 py-2 text-xs text-gray-500">{REASON_LABELS[a.reasonCode]}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(a.value)}</td>
                  <td className="px-3 py-2 text-gray-500">{new Date(a.requestedAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right">
                    {isOwn ? (
                      <span className="text-xs text-gray-400" title="You created this request — a different admin must approve it">your request</span>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setStepUpFor(a.id)} className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700">Approve</button>
                        <button onClick={() => void doReject(a.id)} className="rounded-md border border-red-300 dark:border-red-800 px-2 py-1 text-xs text-red-700 dark:text-red-400">Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {stepUpFor && (
        <StepUpAuthModal
          actionType="STOCK_ADJUSTMENT_APPROVAL"
          referenceModule="STOCK_ADJUSTMENT"
          requiredRole="admin"
          requiredRoleLabel="Admin"
          onApproved={() => { const id = stepUpFor; setStepUpFor(null); void doApprove(id); }}
          onCancel={() => setStepUpFor(null)}
        />
      )}
    </div>
  );
}
