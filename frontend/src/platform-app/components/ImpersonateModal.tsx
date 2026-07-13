import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiClientError } from '../../shared/api/client';
import { encodeImpersonationHash } from '../../shared/impersonation/session';
import { platformApi } from '../api/platform.api';

/**
 * Reason-gated impersonation start. On confirm it calls the backend, receives the
 * tamper-evident token, and opens the tenant-facing app IN A NEW TAB carrying that
 * token via the URL hash — so this platform-app tab keeps its own staff session
 * while the new tab runs as the impersonated tenant user.
 */
export function ImpersonateModal({ tenantId, pharmacyName, onClose }: { tenantId: string; pharmacyName: string; onClose: () => void }) {
  const { data: users, isLoading } = useQuery({ queryKey: ['platform', 'tenant-users', tenantId], queryFn: async () => (await platformApi.tenantUsers(tenantId)).data });
  const [targetUserId, setTargetUserId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!targetUserId) return setError('Select a user to impersonate.');
    if (reason.trim().length < 10) return setError('Please give a reason of at least 10 characters (it is audited).');
    setBusy(true);
    try {
      const res = (await platformApi.startImpersonation({ targetPharmacyId: tenantId, targetUserId, reason: reason.trim() })).data;
      const hash = encodeImpersonationHash({
        token: res.token, sessionId: res.sessionId, expiresAt: res.expiresAt,
        pharmacyName: res.pharmacy.businessName, userName: res.targetUser.name,
        returnTo: `/platform-admin/tenants/${tenantId}`,
      });
      // Record a marker so the platform-app header can show an active indicator.
      localStorage.setItem('pms_active_impersonation', JSON.stringify({ sessionId: res.sessionId, expiresAt: res.expiresAt, pharmacyName: res.pharmacy.businessName, userName: res.targetUser.name }));
      window.open(`/dashboard#${hash}`, '_blank', 'noopener');
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not start impersonation.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900">
        <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Impersonate a user</h2>
        <p className="mb-3 text-sm text-gray-500">You'll view <strong>{pharmacyName}</strong> exactly as the selected user, for up to 30 minutes. Every action is dual-audited.</p>
        {error && <div role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{error}</div>}
        <label className="block text-sm text-gray-600 dark:text-gray-300">User
          <select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} className={`mt-1 ${input}`} disabled={isLoading}>
            <option value="">{isLoading ? 'Loading users…' : 'Select a user…'}</option>
            {users?.map((u) => <option key={u.id} value={u.id} disabled={u.status === 'DEACTIVATED'}>{u.name} · {u.role ?? '—'} {u.status !== 'ACTIVE' ? `(${u.status})` : ''}</option>)}
          </select>
        </label>
        <label className="mt-3 block text-sm text-gray-600 dark:text-gray-300">Reason (audited, min 10 chars)
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Investigating support ticket #4521 — POS error report" className={`mt-1 ${input}`} />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm dark:border-slate-700">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50">{busy ? 'Starting…' : 'Start impersonation'}</button>
        </div>
      </form>
    </div>
  );
}
