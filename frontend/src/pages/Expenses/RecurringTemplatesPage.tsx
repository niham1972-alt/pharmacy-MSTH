import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { ApiClientError } from '../../shared/api/client';
import { useRecurringTemplates } from '../../features/expenses/hooks/useRecurringTemplates';
import { RecurringTemplatesTable } from '../../features/expenses/components/RecurringTemplatesTable';
import { ExpenseForm } from '../../features/expenses/components/ExpenseForm';

const CAN_MANAGE = ['super_admin', 'admin', 'accountant'];

export function RecurringTemplatesPage() {
  const { user } = useAuth();
  const canManage = CAN_MANAGE.includes(user?.role ?? '');
  const { query, pause, resume, end, runGeneration } = useRecurringTemplates();
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busyId = pause.isPending ? (pause.variables as string) : resume.isPending ? (resume.variables as string) : end.isPending ? (end.variables as string) : undefined;

  const doRun = async () => {
    setError(null); setMessage(null);
    try {
      const res = await runGeneration.mutateAsync();
      setMessage(`Generation run: ${res.data.generated} created, ${res.data.skipped} already present, ${res.data.failed} failed.`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Generation failed.');
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Recurring Expense Templates</h1>
          <Link to="/expenses" className="text-sm text-brand-600 hover:underline">← Back to expenses</Link>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={() => void doRun()} disabled={runGeneration.isPending} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm disabled:opacity-60">
              {runGeneration.isPending ? 'Running…' : 'Run generation now'}
            </button>
            <button onClick={() => setAdding((v) => !v)} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">{adding ? 'Close' : '+ New Template'}</button>
          </div>
        )}
      </div>

      {message && <div className="mb-3 rounded-md bg-green-50 dark:bg-green-950/40 px-3 py-2 text-sm text-green-700 dark:text-green-300">{message}</div>}
      {error && <div role="alert" className="mb-3 rounded-md bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}

      {adding && canManage && (
        <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">New recurring template</h2>
          <p className="mb-3 text-xs text-gray-500">Toggle &ldquo;Make this recurring&rdquo; below and set the frequency. Leave the amount blank for variable bills like utilities.</p>
          <ExpenseForm onDone={() => setAdding(false)} onCancel={() => setAdding(false)} />
        </div>
      )}

      <RecurringTemplatesTable
        rows={query.data}
        isLoading={query.isLoading}
        canManage={canManage}
        busyId={busyId}
        onPause={(id) => pause.mutate(id)}
        onResume={(id) => resume.mutate(id)}
        onEnd={(id) => { if (confirm('End this template? Future generation stops; existing expenses are kept.')) end.mutate(id); }}
      />
    </div>
  );
}
