import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '../../shared/api/client';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { platformApi, Plan } from '../api/platform.api';

const empty = { name: '', priceAmount: '0', billingInterval: 'MONTHLY', maxUsers: '', maxBranches: '', maxMonthlyTransactions: '' };

export function SubscriptionPlansPage() {
  const qc = useQueryClient();
  const { data: plans, isLoading } = useQuery({ queryKey: ['platform', 'plans'], queryFn: async () => (await platformApi.plans()).data });
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['platform', 'plans'] });

  const body = () => ({
    name: form.name, priceAmount: Number(form.priceAmount), billingInterval: form.billingInterval,
    maxUsers: form.maxUsers ? Number(form.maxUsers) : undefined, maxBranches: form.maxBranches ? Number(form.maxBranches) : undefined,
    maxMonthlyTransactions: form.maxMonthlyTransactions ? Number(form.maxMonthlyTransactions) : undefined,
  });
  const save = useMutation({
    mutationFn: async () => (editId ? platformApi.updatePlan(editId, { ...body(), isActive: true }) : platformApi.createPlan(body())),
    onSuccess: () => { invalidate(); setForm(empty); setEditId(null); setError(null); },
    onError: (e) => setError(e instanceof ApiClientError ? e.message : 'Save failed'),
  });
  const retire = useMutation({ mutationFn: (id: string) => platformApi.retirePlan(id), onSuccess: invalidate });

  const edit = (p: Plan) => { setEditId(p.id); setForm({ name: p.name, priceAmount: String(p.priceAmount), billingInterval: p.billingInterval, maxUsers: p.maxUsers?.toString() ?? '', maxBranches: p.maxBranches?.toString() ?? '', maxMonthlyTransactions: p.maxMonthlyTransactions?.toString() ?? '' }); };
  const input = 'w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800';

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Subscription Plans</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold">{editId ? 'Edit plan' : 'New plan'}</h2>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <input required placeholder="Name (e.g. Starter)" className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="flex gap-2">
            <input type="number" min="0" step="0.01" placeholder="Price" className={input} value={form.priceAmount} onChange={(e) => setForm({ ...form, priceAmount: e.target.value })} />
            <select className={input} value={form.billingInterval} onChange={(e) => setForm({ ...form, billingInterval: e.target.value })}><option value="MONTHLY">Monthly</option><option value="ANNUAL">Annual</option></select>
          </div>
          <input type="number" min="0" placeholder="Max users (blank = ∞)" className={input} value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: e.target.value })} />
          <input type="number" min="0" placeholder="Max branches (blank = ∞)" className={input} value={form.maxBranches} onChange={(e) => setForm({ ...form, maxBranches: e.target.value })} />
          <input type="number" min="0" placeholder="Max monthly txns (blank = ∞)" className={input} value={form.maxMonthlyTransactions} onChange={(e) => setForm({ ...form, maxMonthlyTransactions: e.target.value })} />
          <div className="flex gap-2">
            <button type="submit" disabled={save.isPending} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{editId ? 'Update' : 'Create'}</button>
            {editId && <button type="button" onClick={() => { setEditId(null); setForm(empty); }} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-700">Cancel</button>}
          </div>
        </form>

        <div className="lg:col-span-2 overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-800">
          <table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-slate-900/40"><tr><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Users</th><th className="px-3 py-2">Branches</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {isLoading && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">Loading…</td></tr>}
              {plans?.map((p) => (
                <tr key={p.id} className={p.isActive ? '' : 'opacity-50'}>
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2">{formatCurrency(p.priceAmount)}/{p.billingInterval.toLowerCase()}</td>
                  <td className="px-3 py-2">{p.maxUsers ?? '∞'}</td>
                  <td className="px-3 py-2">{p.maxBranches ?? '∞'}</td>
                  <td className="px-3 py-2">{p.isActive ? <span className="text-green-600">Active</span> : <span className="text-gray-500">Retired</span>}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => edit(p)} className="mr-2 text-indigo-600 hover:underline">Edit</button>
                    {p.isActive && <button onClick={() => { if (window.confirm('Retire this plan? Existing tenants keep it; it just becomes unassignable.')) retire.mutate(p.id); }} className="text-red-500 hover:underline">Retire</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
