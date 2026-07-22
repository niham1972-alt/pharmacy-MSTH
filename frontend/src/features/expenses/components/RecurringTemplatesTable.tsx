import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { RECURRENCE_LABELS, RecurringTemplate } from '../types/expense.types';

interface Props {
  rows?: RecurringTemplate[];
  isLoading?: boolean;
  canManage: boolean;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onEnd: (id: string) => void;
  busyId?: string;
}

export function RecurringTemplatesTable({ rows, isLoading, canManage, onPause, onResume, onEnd, busyId }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2">Payee</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Frequency</th>
            <th className="px-3 py-2 text-right">Default amount</th>
            <th className="px-3 py-2">Next generation</th>
            <th className="px-3 py-2">Status</th>
            {canManage && <th className="px-3 py-2 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {isLoading && <tr><td colSpan={canManage ? 7 : 6} className="px-3 py-8 text-center text-gray-400">Loading…</td></tr>}
          {!isLoading && rows?.length === 0 && (
            <tr><td colSpan={canManage ? 7 : 6} className="px-3 py-10 text-center text-gray-400">No recurring templates set up — add one for regular costs like rent.</td></tr>
          )}
          {rows?.map((t) => {
            const ended = !!t.endedAt;
            return (
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                <td className="px-3 py-2 font-medium">{t.payeeName}</td>
                <td className="px-3 py-2 text-gray-500">{t.categoryName ?? '—'}</td>
                <td className="px-3 py-2">{RECURRENCE_LABELS[t.recurrenceFrequency]} · day {t.dayOfPeriod}</td>
                <td className="px-3 py-2 text-right">{t.defaultAmount != null ? formatCurrency(t.defaultAmount) : <span className="text-gray-400">variable</span>}</td>
                <td className="px-3 py-2 text-gray-500">{t.nextGenerationDate ? new Date(t.nextGenerationDate).toLocaleDateString() : '—'}</td>
                <td className="px-3 py-2">
                  {ended ? (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800">Ended</span>
                  ) : t.isActive ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/40 dark:text-green-300">Active</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Paused</span>
                  )}
                </td>
                {canManage && (
                  <td className="px-3 py-2 text-right">
                    {!ended && (
                      <div className="flex justify-end gap-2">
                        {t.isActive ? (
                          <button disabled={busyId === t.id} onClick={() => onPause(t.id)} className="text-xs text-amber-700 hover:underline disabled:opacity-50">Pause</button>
                        ) : (
                          <button disabled={busyId === t.id} onClick={() => onResume(t.id)} className="text-xs text-green-700 hover:underline disabled:opacity-50">Resume</button>
                        )}
                        <button disabled={busyId === t.id} onClick={() => onEnd(t.id)} className="text-xs text-red-600 hover:underline disabled:opacity-50">End</button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
