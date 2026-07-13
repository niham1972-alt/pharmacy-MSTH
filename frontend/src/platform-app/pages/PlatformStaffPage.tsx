import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '../../shared/api/client';
import { platformApi } from '../api/platform.api';

const ROLES = ['SUPER_ADMIN', 'SUPPORT', 'BILLING_OPS'] as const;

export function PlatformStaffPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['platform', 'staff'], queryFn: async () => (await platformApi.staff()).data });
  const [form, setForm] = useState({ authUserId: '', name: '', email: '', role: 'SUPPORT' });
  const [error, setError] = useState<string | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['platform', 'staff'] });
  const create = useMutation({ mutationFn: () => platformApi.createStaff(form), onSuccess: () => { invalidate(); setForm({ authUserId: '', name: '', email: '', role: 'SUPPORT' }); setError(null); }, onError: (e) => setError(e instanceof ApiClientError ? e.message : 'Failed') });
  const update = useMutation({ mutationFn: (v: { id: string; body: unknown }) => platformApi.updateStaff(v.id, v.body), onSuccess: invalidate });
  const input = 'w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800';

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-gray-900 dark:text-gray-100">Platform Staff</h1>
      <p className="mb-4 text-sm text-gray-500">Vendor staff accounts — a separate identity space from any pharmacy's users. `authUserId` links to the Supabase Auth account you provision for them.</p>
      <div className="grid gap-4 lg:grid-cols-3">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold">Add staff</h2>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <input required placeholder="Name" className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required type="email" placeholder="Email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input required placeholder="Supabase auth user id" className={input} value={form.authUserId} onChange={(e) => setForm({ ...form, authUserId: e.target.value })} />
          <select className={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{r.toLowerCase()}</option>)}</select>
          <button type="submit" disabled={create.isPending} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Add</button>
        </form>
        <div className="lg:col-span-2 overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-800">
          <table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-slate-900/40"><tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {isLoading && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Loading…</td></tr>}
              {data?.map((s) => (
                <tr key={s.id}><td className="px-3 py-2 font-medium">{s.name}</td><td className="px-3 py-2 text-gray-500">{s.email}</td>
                  <td className="px-3 py-2">
                    <select value={s.role} onChange={(e) => update.mutate({ id: s.id, body: { role: e.target.value } })} className="rounded border border-gray-300 bg-transparent px-1 py-0.5 text-xs dark:border-slate-700">{ROLES.map((r) => <option key={r} value={r}>{r.toLowerCase()}</option>)}</select>
                  </td>
                  <td className="px-3 py-2">{s.status}</td>
                  <td className="px-3 py-2 text-right"><button onClick={() => update.mutate({ id: s.id, body: { status: s.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } })} className="text-indigo-600 hover:underline">{s.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
