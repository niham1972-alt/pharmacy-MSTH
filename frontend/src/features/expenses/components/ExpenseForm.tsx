import { FormEvent, useState } from 'react';
import { ApiClientError } from '../../../shared/api/client';
import { useExpenseCategories } from '../hooks/useExpensesList';
import { useExpenseMutations } from '../hooks/useExpenseMutations';
import { useRecurringTemplates } from '../hooks/useRecurringTemplates';
import { ReceiptUploadZone } from './ReceiptUploadZone';
import { RecurringConfig, RecurringToggleSection } from './RecurringToggleSection';

const inputCls = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm w-full';
const today = () => new Date().toISOString().slice(0, 10);

/** Add-expense form with a "make recurring" toggle (spec §5). On recurring, it
 *  creates a template instead of a one-off expense. */
export function ExpenseForm({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const { data: categories } = useExpenseCategories();
  const { create } = useExpenseMutations();
  const { create: createTemplate } = useRecurringTemplates();

  const [categoryId, setCategoryId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [amount, setAmount] = useState('');
  const [incurredDate, setIncurredDate] = useState(today());
  const [dueDate, setDueDate] = useState('');
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>();
  const [notes, setNotes] = useState('');
  const [recurring, setRecurring] = useState<RecurringConfig>({ enabled: false, recurrenceFrequency: 'MONTHLY', dayOfPeriod: 1 });
  const [error, setError] = useState<string | null>(null);

  const activeCategories = (categories ?? []).filter((c) => c.isActive);
  const dueBeforeIncurred = dueDate && dueDate < incurredDate;
  const busy = create.isPending || createTemplate.isPending;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = Number(amount);
    if (!categoryId) return setError('Please choose a category.');
    if (!payeeName.trim()) return setError('Please enter a payee / vendor name.');
    if (!(amt > 0) && !(recurring.enabled && amount === '')) return setError('Amount must be greater than zero.');
    try {
      if (recurring.enabled) {
        await createTemplate.mutateAsync({
          categoryId,
          payeeName: payeeName.trim(),
          defaultAmount: amount === '' ? undefined : amt,
          recurrenceFrequency: recurring.recurrenceFrequency,
          dayOfPeriod: recurring.dayOfPeriod,
          notes: notes || undefined,
        });
      } else {
        await create.mutateAsync({
          categoryId,
          payeeName: payeeName.trim(),
          amount: amt,
          incurredDate: new Date(incurredDate).toISOString(),
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          receiptUrl,
          notes: notes || undefined,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not save the expense.');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <div role="alert" className="rounded-md bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500">Category *</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls} required>
            <option value="">Select a category…</option>
            {activeCategories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500">Payee / vendor *</span>
          <input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} placeholder="e.g. City Power Co." className={inputCls} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500">Amount {recurring.enabled ? '(optional — leave blank for variable bills)' : '*'}</span>
          <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={inputCls} />
        </label>
        {!recurring.enabled && (
          <>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-gray-500">Date incurred</span>
              <input type="date" value={incurredDate} onChange={(e) => setIncurredDate(e.target.value)} className={inputCls} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-gray-500">Due date</span>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
              {dueBeforeIncurred && <span className="mt-1 block text-[11px] text-amber-600">Due date is before the incurred date — recording a past-due expense?</span>}
            </label>
          </>
        )}
      </div>

      {!recurring.enabled && (
        <div>
          <span className="mb-1 block text-xs text-gray-500">Receipt / invoice</span>
          <ReceiptUploadZone value={receiptUrl} onChange={setReceiptUrl} />
        </div>
      )}

      <label className="block text-sm">
        <span className="mb-1 block text-xs text-gray-500">Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
      </label>

      <RecurringToggleSection value={recurring} onChange={setRecurring} />

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && <button type="button" onClick={onCancel} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Cancel</button>}
        <button type="submit" disabled={busy} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {busy ? 'Saving…' : recurring.enabled ? 'Create recurring template' : 'Record expense'}
        </button>
      </div>
    </form>
  );
}
