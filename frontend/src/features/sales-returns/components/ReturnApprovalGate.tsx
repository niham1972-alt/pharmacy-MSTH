import { useState } from 'react';
import { StepUpAuthModal } from '../../users/components/StepUpAuthModal';

/**
 * Wraps Module 16's StepUpAuthModal for prescription/clinical returns. When a
 * cashier processes such a return, a pharmacist/admin authorizes inline; the
 * resulting step-up id is passed to the create call so the backend can verify it.
 */
export function ReturnApprovalGate({ approved, onApproved, onCancel }: { approved: boolean; onApproved: (stepUpId: string) => void; onCancel: () => void }) {
  const [open, setOpen] = useState(false);
  if (approved) {
    return <p className="rounded-md border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950 px-3 py-2 text-sm text-green-700 dark:text-green-300">✓ Supervisor authorization captured.</p>;
  }
  return (
    <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 px-3 py-2">
      <p className="text-sm text-amber-800 dark:text-amber-300">This return needs pharmacist/admin approval before it can be confirmed.</p>
      <button type="button" onClick={() => setOpen(true)} className="mt-1 rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700">Authorize with supervisor</button>
      {open && (
        <StepUpAuthModal
          actionType="RETURN_APPROVAL"
          referenceModule="SALES_RETURN"
          requiredRole="PHARMACIST"
          requiredRoleLabel="pharmacist or admin"
          onApproved={(_uid, stepUpId) => { setOpen(false); onApproved(stepUpId); }}
          onCancel={() => { setOpen(false); onCancel(); }}
        />
      )}
    </div>
  );
}
