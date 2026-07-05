import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { posApi } from '../../features/pos/api/pos.api';

export function SessionClosePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: session, isLoading } = useQuery({ queryKey: ['pos', 'session'], queryFn: async () => (await posApi.currentSession()).data });
  const [actualCash, setActualCash] = useState('');
  const [result, setResult] = useState<{ expectedCash: number | null; actualCash: number | null; variance: number | null; flaggedForReview?: boolean } | null>(null);

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!session) return <div className="mx-auto max-w-sm text-center text-sm text-gray-500">No open session. <button onClick={() => navigate('/pos')} className="text-brand-600 underline">Back to POS</button></div>;

  const expectedCash = session.openingFloat + session.cashCollected;

  const close = async () => {
    const res = await posApi.closeSession(session.id, Number(actualCash || expectedCash));
    setResult(res.data);
    qc.invalidateQueries({ queryKey: ['pos', 'session'] });
  };

  if (result) {
    return (
      <div className="mx-auto max-w-sm rounded-lg border border-gray-200 dark:border-gray-800 p-6 text-center">
        <h1 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Session closed</h1>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Expected cash</span><span>{formatCurrency(result.expectedCash ?? 0)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Counted cash</span><span>{formatCurrency(result.actualCash ?? 0)}</span></div>
          <div className={`flex justify-between font-medium ${result.variance ? 'text-orange-600' : 'text-green-600'}`}><span>Variance</span><span>{formatCurrency(result.variance ?? 0)}</span></div>
        </div>
        {result.flaggedForReview && <p className="mt-2 text-xs text-orange-600">⚠ Variance exceeds threshold — flagged for admin review.</p>}
        <button onClick={() => navigate('/pos')} className="mt-4 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white">Done</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm rounded-lg border border-gray-200 dark:border-gray-800 p-6">
      <h1 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Close Session</h1>
      <div className="mb-3 space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">Opening float</span><span>{formatCurrency(session.openingFloat)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Transactions</span><span>{session.salesCount} · {formatCurrency(session.salesTotal)}</span></div>
        <div className="my-1 border-t border-dashed border-gray-200 dark:border-gray-700" />
        {session.byMethod.map((m) => (
          <div key={m.method} className="flex justify-between text-gray-500"><span>{m.method}</span><span>{formatCurrency(m.amount)}</span></div>
        ))}
        {session.byMethod.length === 0 && <div className="text-gray-400">No sales this session.</div>}
        <div className="my-1 border-t border-dashed border-gray-200 dark:border-gray-700" />
        <div className="flex justify-between"><span className="text-gray-500">Cash sales</span><span>{formatCurrency(session.cashCollected)}</span></div>
        <div className="flex justify-between font-medium"><span>Expected in drawer</span><span>{formatCurrency(expectedCash)}</span></div>
      </div>
      <label className="mb-3 block"><span className="text-xs text-gray-500">Counted cash</span>
        <input type="number" min="0" value={actualCash} onChange={(e) => setActualCash(e.target.value)} placeholder={String(expectedCash)} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
      </label>
      <div className="flex gap-2">
        <button onClick={() => navigate('/pos')} className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm">Cancel</button>
        <button onClick={close} className="flex-1 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white">Close Session</button>
      </div>
    </div>
  );
}
