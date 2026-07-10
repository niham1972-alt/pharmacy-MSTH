import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ApiClientError } from '../../shared/api/client';
import { SYSTEM_ROLES, usersApi } from '../../features/users/api/users.api';
import { RoleBadges, ROLE_LABEL, UserStatusBadge } from '../../features/users/components/UserStatusBadge';

const TABS = ['Roles & Branches', 'Permission Overrides', 'Login Activity'] as const;

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Roles & Branches');
  const [err, setErr] = useState<string | null>(null);
  const [newRole, setNewRole] = useState('PHARMACIST');
  const [showPwd, setShowPwd] = useState(false);
  const { data: u, isLoading, isError, refetch } = useQuery({ queryKey: ['users', 'detail', id], queryFn: async () => (await usersApi.detail(id!)).data, enabled: !!id });
  const activity = useQuery({ queryKey: ['users', 'activity', id], queryFn: async () => (await usersApi.loginActivity(id!)).data, enabled: !!id && tab === 'Login Activity' });

  if (isLoading) return <div className="animate-pulse text-gray-400">Loading user…</div>;
  if (isError || !u) return <div className="text-red-600">Couldn't load user. <button onClick={() => refetch()} className="underline">Retry</button></div>;

  const act = async (fn: () => Promise<unknown>, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setErr(null);
    try { await fn(); refetch(); } catch (e) { setErr(e instanceof ApiClientError ? e.message : 'Action failed.'); }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 text-sm text-gray-500"><Link to="/users" className="underline">Users</Link> / {u.name}</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{u.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">{u.email} <UserStatusBadge status={u.status} /></p>
        </div>
        <div className="flex gap-2">
          {u.status !== 'DEACTIVATED' && <button onClick={() => setShowPwd(true)} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Set password</button>}
          {u.status === 'ACTIVE' && <button onClick={() => act(() => usersApi.suspend(u.id), 'Suspend this user? They will be unable to log in; historical records stay intact.')} className="rounded-md border border-orange-300 dark:border-orange-800 px-3 py-1.5 text-sm text-orange-700 dark:text-orange-400">Suspend</button>}
          {u.status === 'SUSPENDED' && <button onClick={() => act(() => usersApi.reactivate(u.id))} className="rounded-md border border-green-300 dark:border-green-800 px-3 py-1.5 text-sm text-green-700 dark:text-green-400">Reactivate</button>}
          {u.status !== 'DEACTIVATED' && <button onClick={() => act(() => usersApi.deactivate(u.id), 'Deactivate (offboard) this user? This blocks login permanently; historical records stay attributed.')} className="rounded-md border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm text-red-700 dark:text-red-400">Deactivate</button>}
          <button onClick={() => act(() => usersApi.revokeSessions(u.id), 'Force logout — revoke this user’s active sessions?')} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Revoke Sessions</button>
        </div>
      </div>
      {err && <div role="alert" className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{err}</div>}

      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm ${tab === t ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400 font-medium' : 'text-gray-500'}`}>{t}</button>)}
      </div>

      {tab === 'Roles & Branches' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
            <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Roles</h2><RoleBadges roles={u.roles.map((r) => r.role)} /></div>
            <div className="flex flex-wrap gap-2">
              {u.roles.map((r) => (
                <span key={r.role} className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-xs">{ROLE_LABEL[r.role]}<button onClick={() => act(() => usersApi.removeRole(u.id, r.role))} className="text-red-500" title="Remove role">✕</button></span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm">{SYSTEM_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
              <button onClick={() => act(() => usersApi.assignRole(u.id, newRole))} className="rounded-md bg-brand-600 px-3 py-1 text-sm text-white">Assign role</button>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
            <h2 className="mb-2 text-sm font-semibold">Branch access</h2>
            <div className="flex flex-wrap gap-2 text-xs">
              {u.branchAccess.map((b) => <span key={b.branchId} className="inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5">{b.branchId.slice(0, 8)}…{b.isDefault && <span className="ml-1 text-brand-600">(default)</span>}</span>)}
              {u.branchAccess.length === 0 && <span className="text-gray-400">No branch access</span>}
            </div>
          </div>
        </div>
      )}

      {tab === 'Permission Overrides' && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {u.permissionOverrides.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-500">No permission overrides — this user follows their role's standard permissions.</p>}
          {u.permissionOverrides.map((o) => (
            <div key={o.permissionKey} className="flex items-center justify-between px-4 py-2 text-sm">
              <div><code className="text-xs">{o.permissionKey}</code>{o.reason && <span className="block text-xs text-gray-400">{o.reason}</span>}</div>
              <button onClick={() => act(() => usersApi.removeOverride(u.id, o.permissionKey))} className="text-xs text-red-500">Remove</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'Login Activity' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">IP</th><th className="px-3 py-2">Device</th><th className="px-3 py-2">Result</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {activity.isLoading && <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">Loading…</td></tr>}
              {activity.data?.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">No login activity recorded yet.</td></tr>}
              {activity.data?.map((l) => <tr key={l.id}><td className="px-3 py-2 text-gray-500">{new Date(l.loginAt).toLocaleString()}</td><td className="px-3 py-2 text-gray-500">{l.ipAddress ?? '—'}</td><td className="px-3 py-2 text-gray-500 max-w-xs truncate">{l.userAgent ?? '—'}</td><td className="px-3 py-2">{l.success ? <span className="text-green-600">Success</span> : <span className="text-red-600">Failed</span>}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}

      {showPwd && <SetPasswordModal userId={u.id} userName={u.name} pending={u.status === 'PENDING_ACTIVATION'} onClose={() => setShowPwd(false)} onDone={() => { setShowPwd(false); refetch(); }} />}
    </div>
  );
}

function SetPasswordModal({ userId, userName, pending, onClose, onDone }: { userId: string; userName: string; pending: boolean; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = 'w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';
  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSave = password.length >= 8 && password === confirm && !busy;

  const submit = async () => {
    if (!canSave) return;
    setBusy(true); setError(null);
    try { await usersApi.setPassword(userId, password); onDone(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : 'Could not set the password.'); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-lg bg-white dark:bg-gray-900 p-5 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Set password</h2>
        <p className="mb-3 text-xs text-gray-500">For <span className="font-medium">{userName}</span>. {pending ? 'This will also activate their account.' : 'Existing sessions stay valid — use “Revoke Sessions” to force re-login.'}</p>
        {error && <div role="alert" className="mb-2 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
        <label className="mb-2 block"><span className="text-xs text-gray-500">New password (min 8)</span><input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} autoFocus /></label>
        <label className="mb-1 block"><span className="text-xs text-gray-500">Confirm password</span><input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} className={input} /></label>
        {tooShort && <p className="mb-1 text-xs text-red-600">Must be at least 8 characters.</p>}
        {mismatch && <p className="mb-1 text-xs text-red-600">Passwords don't match.</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={!canSave} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy ? 'Saving…' : 'Set password'}</button>
        </div>
      </div>
    </div>
  );
}
