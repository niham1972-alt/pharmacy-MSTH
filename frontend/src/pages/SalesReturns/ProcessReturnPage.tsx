import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { ApiClientError } from '../../shared/api/client';
import { useCreateReturn, useReturnEligibility } from '../../features/sales-returns/hooks/salesReturns.hooks';
import { SaleLookupForm } from '../../features/sales-returns/components/SaleLookupForm';
import { EligibilityLineItemsTable } from '../../features/sales-returns/components/EligibilityLineItemsTable';
import { ReturnLineItemEditor, type DraftLine } from '../../features/sales-returns/components/ReturnLineItemEditor';
import { RefundMethodSelector } from '../../features/sales-returns/components/RefundMethodSelector';
import { RefundSummaryCard } from '../../features/sales-returns/components/RefundSummaryCard';
import { ReturnApprovalGate } from '../../features/sales-returns/components/ReturnApprovalGate';
import { ReturnReceiptPreview } from '../../features/sales-returns/components/ReturnReceiptPreview';
import type { CreateReturnLine, RefundMethod, SalesReturnDetail } from '../../features/sales-returns/types/sales-return.types';

const emptyDraft = (): DraftLine => ({ selected: false, quantity: 1, conditionAssessment: 'RESALEABLE', reasonCode: 'CUSTOMER_CHANGED_MIND', reasonNote: '' });

export function ProcessReturnPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [saleId, setSaleId] = useState<string | null>(params.get('saleId'));
  const [drafts, setDrafts] = useState<Record<string, DraftLine>>({});
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('CASH');
  const [refundReference, setRefundReference] = useState('');
  const [notes, setNotes] = useState('');
  const [stepUpId, setStepUpId] = useState<string | null>(null);
  const [done, setDone] = useState<SalesReturnDetail | null>(null);

  const { data: elig, isLoading, isError, refetch } = useReturnEligibility(saleId);
  const createReturn = useCreateReturn();

  const eligibleLines = elig?.lines.filter((l) => l.eligible) ?? [];
  const ineligibleLines = elig?.lines.filter((l) => !l.eligible) ?? [];
  const draftFor = (id: string) => drafts[id] ?? emptyDraft();

  const selected = useMemo(
    () => eligibleLines.filter((l) => draftFor(l.saleItemId).selected),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eligibleLines, drafts],
  );
  const summaryLines = selected.map((l) => {
    const d = draftFor(l.saleItemId);
    const unit = l.remainingQuantity > 0 ? l.maxRefundForRemaining / l.remainingQuantity : 0;
    return { name: l.name, quantity: d.quantity, amount: Math.round(unit * d.quantity * 100) / 100 };
  });
  const total = Math.round(summaryLines.reduce((s, l) => s + l.amount, 0) * 100) / 100;

  const isCashier = user?.role === 'cashier';
  const needsApproval = isCashier && selected.some((l) => l.requiresApproval || draftFor(l.saleItemId).reasonCode === 'ADVERSE_REACTION');
  const approvalSatisfied = !needsApproval || !!stepUpId;
  const canConfirm = selected.length > 0 && approvalSatisfied && !createReturn.isPending;

  const reset = () => { setSaleId(null); setDrafts({}); setRefundMethod('CASH'); setRefundReference(''); setNotes(''); setStepUpId(null); setDone(null); };

  const confirm = () => {
    if (!saleId) return;
    const items: CreateReturnLine[] = selected.map((l) => {
      const d = draftFor(l.saleItemId);
      return { originalSaleItemId: l.saleItemId, quantityReturned: d.quantity, conditionAssessment: d.conditionAssessment, reasonCode: d.reasonCode, reasonNote: d.reasonNote || undefined };
    });
    createReturn.mutate(
      { originalSaleId: saleId, refundMethod, refundReference: refundReference || undefined, notes: notes || undefined, stepUpId: stepUpId || undefined, items },
      { onSuccess: (data) => setDone(data) },
    );
  };

  if (done) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Return processed ✓</h1>
          <div className="flex gap-2">
            <Link to={`/sales-returns/${done.id}`} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">View detail</Link>
            <button onClick={reset} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">New return</button>
          </div>
        </div>
        <ReturnReceiptPreview ret={done} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Process a return</h1>
        <Link to="/sales-returns" className="text-sm text-brand-600 hover:underline">Return history →</Link>
      </div>

      {!saleId && <SaleLookupForm onFound={(id) => { setSaleId(id); setDrafts({}); }} />}

      {saleId && (
        <>
          <div className="mb-3 flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-800 px-3 py-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Sale <span className="font-mono">{elig?.saleNumber ?? '…'}</span>{elig && <span className="ml-2 text-xs text-gray-400">{new Date(elig.saleDate).toLocaleDateString()} · {elig.customerId ? 'registered customer' : 'walk-in'}</span>}</span>
            <button onClick={reset} className="text-xs text-gray-500 hover:text-red-500">Change sale</button>
          </div>

          {isLoading && <p className="animate-pulse text-gray-400">Checking eligibility…</p>}
          {isError && <p className="text-red-600">Couldn't load this sale. <button onClick={() => refetch()} className="underline">Retry</button></p>}

          {elig && (
            <div className="space-y-4">
              {!elig.withinWindow && <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">This sale is outside the {elig.windowDays}-day return window.</div>}

              {eligibleLines.length > 0 ? (
                <div className="space-y-2">
                  {eligibleLines.map((l) => (
                    <ReturnLineItemEditor key={l.saleItemId} line={l} draft={draftFor(l.saleItemId)} onChange={(d) => setDrafts((prev) => ({ ...prev, [l.saleItemId]: d }))} />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-gray-200 dark:border-gray-800 px-3 py-6 text-center text-sm text-gray-500">No eligible items on this sale.</div>
              )}

              <EligibilityLineItemsTable ineligible={ineligibleLines} />

              {selected.length > 0 && (
                <>
                  <RefundMethodSelector value={refundMethod} onChange={setRefundMethod} reference={refundReference} onReference={setRefundReference} hasCustomer={!!elig.customerId} />
                  <RefundSummaryCard lines={summaryLines} total={total} />
                  <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
                  {needsApproval && <ReturnApprovalGate approved={!!stepUpId} onApproved={setStepUpId} onCancel={() => setStepUpId(null)} />}
                  {createReturn.isError && <p role="alert" className="text-sm text-red-600">{createReturn.error instanceof ApiClientError ? createReturn.error.message : 'Failed to process the return.'}</p>}
                  <div className="flex justify-end">
                    <button onClick={confirm} disabled={!canConfirm} className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{createReturn.isPending ? 'Processing…' : `Confirm return · ${total.toFixed(2)}`}</button>
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
