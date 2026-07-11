import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiClientError } from '../../shared/api/client';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { useCreatePurchaseReturn, useReturnableItems } from '../../features/purchase-returns/hooks/purchaseReturns.hooks';
import { GrnLookupForm } from '../../features/purchase-returns/components/GrnLookupForm';
import { ReturnLineItemEditor, type DraftLine } from '../../features/purchase-returns/components/ReturnLineItemEditor';
import { ReturnDocumentPreview } from '../../features/purchase-returns/components/ReturnDocumentPreview';
import type { CreateReturnLine, PurchaseReturnDetail } from '../../features/purchase-returns/types/purchase-return.types';

const emptyDraft = (): DraftLine => ({ selected: false, quantity: 1, reasonCode: 'DAMAGED_DEFECTIVE', reasonNote: '', relatedRecallId: '' });

export function InitiateReturnPage() {
  const [params] = useSearchParams();
  const [grnId, setGrnId] = useState<string | null>(params.get('grnId'));
  const preselectBatchId = params.get('batchId'); // pre-fill entry from Module 6 batch detail
  const [drafts, setDrafts] = useState<Record<string, DraftLine>>({});
  const [notes, setNotes] = useState('');
  const [creditOverride, setCreditOverride] = useState('');
  const [done, setDone] = useState<PurchaseReturnDetail | null>(null);

  const { data: grn, isLoading, isError, refetch } = useReturnableItems(grnId);
  const create = useCreatePurchaseReturn();

  const returnable = grn?.lines.filter((l) => l.remainingQuantity > 0) ?? [];
  const draftFor = (id: string) => drafts[id] ?? { ...emptyDraft(), selected: preselectBatchId != null && returnable.find((l) => l.grnItemId === id)?.batchId === preselectBatchId };

  const selected = useMemo(
    () => returnable.filter((l) => draftFor(l.grnItemId).selected),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [returnable, drafts],
  );
  const autoCredit = selected.reduce((s, l) => s + l.unitCostAtReceipt * draftFor(l.grnItemId).quantity, 0);
  const expectedCredit = creditOverride !== '' ? Number(creditOverride) : Math.round(autoCredit * 100) / 100;

  const reset = () => { setGrnId(null); setDrafts({}); setNotes(''); setCreditOverride(''); setDone(null); };

  const confirm = () => {
    if (!grnId) return;
    const items: CreateReturnLine[] = selected.map((l) => {
      const d = draftFor(l.grnItemId);
      return { originalGrnItemId: l.grnItemId, quantityReturned: d.quantity, reasonCode: d.reasonCode, reasonNote: d.reasonNote || undefined, relatedRecallId: d.reasonCode === 'QUALITY_RECALL' && d.relatedRecallId ? d.relatedRecallId : undefined };
    });
    create.mutate({ originalGrnId: grnId, expectedCreditAmount: creditOverride !== '' ? Number(creditOverride) : undefined, notes: notes || undefined, items }, { onSuccess: setDone });
  };

  if (done) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Purchase return created ✓</h1>
          <div className="flex gap-2">
            <Link to={`/purchase-returns/${done.id}`} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">View detail</Link>
            <button onClick={reset} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">New return</button>
          </div>
        </div>
        <ReturnDocumentPreview ret={done} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Return stock to supplier</h1>
        <Link to="/purchase-returns" className="text-sm text-brand-600 hover:underline">All returns →</Link>
      </div>

      {!grnId && <GrnLookupForm onSelect={(id) => { setGrnId(id); setDrafts({}); }} />}

      {grnId && (
        <>
          <div className="mb-3 flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-800 px-3 py-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">GRN <span className="font-mono">{grn?.grnNumber ?? '…'}</span>{grn && <span className="ml-2 text-xs text-gray-400">{grn.supplierName} · {new Date(grn.receivedDate).toLocaleDateString()}</span>}</span>
            <button onClick={reset} className="text-xs text-gray-500 hover:text-red-500">Change GRN</button>
          </div>

          {isLoading && <p className="animate-pulse text-gray-400">Loading returnable items…</p>}
          {isError && <p className="text-red-600">Couldn't load this GRN. <button onClick={() => refetch()} className="underline">Retry</button></p>}

          {grn && (
            <div className="space-y-4">
              {returnable.length > 0 ? (
                <div className="space-y-2">
                  {returnable.map((l) => (
                    <ReturnLineItemEditor key={l.grnItemId} line={l} draft={draftFor(l.grnItemId)} onChange={(d) => setDrafts((prev) => ({ ...prev, [l.grnItemId]: d }))} />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-gray-200 dark:border-gray-800 px-3 py-6 text-center text-sm text-gray-500">No items eligible for return from this GRN.</div>
              )}

              {selected.length > 0 && (
                <>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Expected credit</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">auto {formatCurrency(Math.round(autoCredit * 100) / 100)}</span>
                        <input type="number" step="0.01" min="0" value={creditOverride} onChange={(e) => setCreditOverride(e.target.value)} placeholder="override" className="w-28 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm" />
                      </div>
                    </div>
                    <p className="mt-1 text-right text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(expectedCredit)}</p>
                    <p className="text-[11px] text-gray-400">Supplier agreements (e.g. near-expiry) may credit a different rate — override if needed.</p>
                  </div>
                  <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
                  {create.isError && <p role="alert" className="text-sm text-red-600">{create.error instanceof ApiClientError ? create.error.message : 'Failed to create the return.'}</p>}
                  <div className="flex justify-end">
                    <button onClick={confirm} disabled={selected.length === 0 || create.isPending} className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{create.isPending ? 'Creating…' : `Confirm return · ${formatCurrency(expectedCredit)}`}</button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
