import { useState } from 'react';
import { ApiClientError } from '../../../shared/api/client';
import { stepUpApi } from '../api/users.api';

/**
 * Reusable step-up (re-auth) modal for elevated actions — imported by Module 4's
 * discount-approval / prescription-verification flows and Module 6's write-off /
 * recall flows. It requests a step-up challenge, then an elevated user enters
 * THEIR OWN email + password inline; the backend verifies the password AND
 * re-checks that they genuinely hold the required role before approving.
 *
 * onApproved receives the verified user's id — the caller attaches it to the
 * action (e.g. Sale.discountApprovedBy) so the audit trail names the approver.
 */
export function StepUpAuthModal({
  actionType,
  referenceModule,
  requiredRole,
  requiredRoleLabel,
  onApproved,
  onCancel,
}: {
  actionType: string;
  referenceModule: string;
  requiredRole: string;
  requiredRoleLabel: string;
  onApproved: (verifiedByUserId: string, stepUpId: string) => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const req = (await stepUpApi.request({ actionType, referenceModule, requiredRole })).data;
      const res = (await stepUpApi.verify(req.id, email.trim(), password)).data;
      onApproved(res.verifiedByUserId, req.id);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-lg bg-white dark:bg-gray-900 p-5 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Elevated authorization</h2>
        <p className="mb-3 text-sm text-gray-500">This action requires a <strong>{requiredRoleLabel}</strong>. Have them enter their credentials to authorize.</p>
        {error && <div role="alert" className="mb-2 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
        <label className="mb-2 block"><span className="text-xs text-gray-500">Authorizer email</span><input value={email} onChange={(e) => setEmail(e.target.value)} className={input} autoFocus /></label>
        <label className="mb-4 block"><span className="text-xs text-gray-500">Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} className={input} /></label>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={busy || !email.trim() || !password} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy ? 'Verifying…' : 'Authorize'}</button>
        </div>
      </div>
    </div>
  );
}
