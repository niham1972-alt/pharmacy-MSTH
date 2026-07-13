import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '../api/platform.api';

const SEVERITY = ['INFO', 'WARNING', 'CRITICAL'];
const tone: Record<string, string> = { INFO: 'text-blue-600', WARNING: 'text-amber-600', CRITICAL: 'text-red-600' };

function phase(a: { startsAt: string; endsAt: string | null; isActive: boolean }): string {
  if (!a.isActive) return 'expired';
  const now = Date.now();
  if (new Date(a.startsAt).getTime() > now) return 'scheduled';
  if (a.endsAt && new Date(a.endsAt).getTime() < now) return 'expired';
  return 'active';
}

export function AnnouncementsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['platform', 'announcements'], queryFn: async () => (await platformApi.announcements()).data });
  const [form, setForm] = useState({ title: '', message: '', severity: 'INFO', endsAt: '' });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['platform', 'announcements'] });
  const create = useMutation({ mutationFn: () => platformApi.createAnnouncement({ title: form.title, message: form.message, severity: form.severity, endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined }), onSuccess: () => { invalidate(); setForm({ title: '', message: '', severity: 'INFO', endsAt: '' }); } });
  const remove = useMutation({ mutationFn: (id: string) => platformApi.removeAnnouncement(id), onSuccess: invalidate });
  const input = 'w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800';

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-gray-900 dark:text-gray-100">Announcements</h1>
      <p className="mb-4 text-sm text-gray-500">Active announcements surface as a banner across every tenant's app.</p>
      <div className="grid gap-4 lg:grid-cols-3">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold">New announcement</h2>
          <input required placeholder="Title" className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea required placeholder="Message" rows={3} className={input} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <div className="flex gap-2">
            <select className={input} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>{SEVERITY.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <input type="datetime-local" className={input} value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} title="Ends at (optional)" />
          </div>
          <button type="submit" disabled={create.isPending} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Publish</button>
        </form>
        <div className="lg:col-span-2 space-y-2">
          {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {data?.length === 0 && <p className="text-sm text-gray-400">No announcements yet.</p>}
          {data?.map((a) => (
            <div key={a.id} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><span className={`text-xs font-bold ${tone[a.severity]}`}>{a.severity}</span><span className="font-medium">{a.title}</span><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-slate-800">{phase(a)}</span></div>
                {phase(a) !== 'expired' && <button onClick={() => remove.mutate(a.id)} className="text-xs text-red-500 hover:underline">Expire now</button>}
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{a.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
