import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { ApiClientError } from '../../shared/api/client';
import { SYSTEM_ROLES, usersApi } from '../../features/users/api/users.api';
import { RoleBadges, ROLE_LABEL, UserStatusBadge } from '../../features/users/components/UserStatusBadge';

export function UsersListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showInvite, setShowInvite] = useState(false);
  const isSuperAdmin = user?.role === 'super_admin';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['users', 'list', { search, role, status, page }],
    queryFn: async () => {
      const res = await usersApi.list({ search: search || undefined, role: role || undefined, status: status || undefined, page, limit: 20 });
      return { data: res.data, meta: res.meta as { page: number; total: number; totalPages: number } };
    },
    placeholderData: keepPreviousData,
  });
  const rows = data?.data ?? [];
  const meta = data?.meta;
  const input = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Users &amp; Roles</h1>
        <div className="flex gap-2">
          {isSuperAdmin && <Link to="/users/permission-matrix" className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Permission Matrix</Link>}
          <button onClick={() => setShowInvite(true)} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">+ Invite User</button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name / email…" className={`w-64 ${input}`} />
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className={input}><option value="">Any role</option>{SYSTEM_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={input}><option value="">Any status</option>{['ACTIVE', 'PENDING_ACTIVATION', 'SUSPENDED', 'DEACTIVATED'].map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
            <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Roles</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Branches</th><th className="px-3 py-2">Last Login</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && Array.from({ length: 5 }).map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={6} className="px-3 py-3"><div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800" /></td></tr>)}
            {isError && <tr><td colSpan={6} className="px-3 py-8 text-center"><p className="text-sm text-red-600">Couldn't load users.</p><button onClick={() => refetch()} className="mt-1 text-sm underline">Retry</button></td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-500">No users yet — invite your first team member.</td></tr>}
            {rows.map((u) => (
              <tr key={u.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40" onClick={() => navigate(`/users/${u.id}`)}>
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{u.name}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{u.email}</td>
                <td className="px-3 py-2"><RoleBadges roles={u.roles} /></td>
                <td className="px-3 py-2"><UserStatusBadge status={u.status} /></td>
                <td className="px-3 py-2 text-gray-500">{u.branchCount}</td>
                <td className="px-3 py-2 text-gray-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>{meta.total} users · page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 disabled:opacity-40">Prev</button>
            <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onDone={(id) => { setShowInvite(false); refetch(); if (id) navigate(`/users/${id}`); }} />}
    </div>
  );
}

function InviteModal({ onClose, onDone }: { onClose: () => void; onDone: (id?: string) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('CASHIER');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const input = 'w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';

  const submit = async () => {
    if (name.trim().length < 2 || !email.trim()) return;
    setBusy(true); setError(null);
    try {
      const res = (await usersApi.invite({ name: name.trim(), email: email.trim(), role })).data;
      setNote(res.note);
      setTimeout(() => onDone(res.id), 1200);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Invite failed.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-lg bg-white dark:bg-gray-900 p-5 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Invite User</h2>
        {error && <div role="alert" className="mb-2 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
        {note && <div className="mb-2 rounded-md border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950 px-3 py-2 text-sm text-green-700 dark:text-green-300">Invited ✓ {note}</div>}
        <label className="mb-2 block"><span className="text-xs text-gray-500">Name *</span><input value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
        <label className="mb-2 block"><span className="text-xs text-gray-500">Email *</span><input value={email} onChange={(e) => setEmail(e.target.value)} className={input} /></label>
        <label className="mb-4 block"><span className="text-xs text-gray-500">Role *</span><select value={role} onChange={(e) => setRole(e.target.value)} className={input}>{SYSTEM_ROLES.filter((r) => r !== 'SUPER_ADMIN').map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></label>
        <p className="mb-3 text-xs text-gray-400">The user is granted access to your current branch. Adjust roles/branches on their profile after inviting.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={busy || name.trim().length < 2 || !email.trim()} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy ? 'Inviting…' : 'Send Invite'}</button>
        </div>
      </div>
    </div>
  );
}
