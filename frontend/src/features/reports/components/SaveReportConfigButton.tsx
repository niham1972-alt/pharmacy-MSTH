import { useState } from 'react';
import { ApiClientError } from '../../../shared/api/client';
import { useSavedReportConfigurations } from '../hooks/useSavedReportConfigurations';
import { ReportFilters, ReportType } from '../types/reports.types';

/** Save the current report + filters for one-click re-running later (spec §2.6/§9). */
export function SaveReportConfigButton({ reportType, filters }: { reportType: ReportType; filters: ReportFilters }) {
  const { create } = useSavedReportConfigurations();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setMsg(null);
    try {
      await create.mutateAsync({ reportType, name: name.trim(), filters });
      setMsg('Saved'); setName(''); setOpen(false);
    } catch (err) {
      setMsg(err instanceof ApiClientError ? err.message : 'Could not save.');
    }
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Save config</button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-lg">
          <label className="mb-1 block text-xs text-gray-500">Configuration name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly P&L" className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm" />
          <p className="mt-1 text-[11px] text-gray-400">Tip: choose a rolling period so it recalculates each run.</p>
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="text-xs text-gray-500">Cancel</button>
            <button onClick={() => void save()} disabled={!name.trim() || create.isPending} className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60">Save</button>
          </div>
          {msg && <p className="mt-1 text-xs text-gray-500">{msg}</p>}
        </div>
      )}
    </div>
  );
}
