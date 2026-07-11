import { useEffect } from 'react';
import { useAuth } from '../../../shared/auth/AuthContext';
import { useDashboardFilters } from '../../../shared/store/dashboardFilters';

/**
 * Only rendered meaningfully for users with access to more than one branch
 * (spec §2.1.I) — otherwise shows a static label for the user's single branch.
 * Defaults to the user's home branch on first login (spec §21), never an
 * arbitrary first entry.
 */
export function BranchSelector() {
  const { user } = useAuth();
  const { branchId, setBranchId } = useDashboardFilters();

  useEffect(() => {
    if (user && !branchId) {
      setBranchId(user.branchId);
    }
  }, [user, branchId, setBranchId]);

  if (!user) return <div />;

  // De-emphasized branch indicator: an icon + abbreviated id (full id on hover),
  // so the raw UUID doesn't dominate the navbar (redesign brief).
  const abbrev = (id: string) => id.slice(0, 8);

  if (user.accessibleBranchIds.length <= 1) {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500" title={`Branch: ${user.branchId}`}>
        <span aria-hidden="true">🏢</span>
        <span className="font-mono">{abbrev(user.branchId)}</span>
      </span>
    );
  }

  return (
    <label className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500" title="Switch branch">
      <span aria-hidden="true">🏢</span>
      <select
        aria-label="Branch"
        value={branchId ?? user.branchId}
        onChange={(e) => setBranchId(e.target.value)}
        className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-0.5 font-mono text-xs text-gray-600 dark:text-gray-300"
      >
        {user.accessibleBranchIds.map((id) => (
          <option key={id} value={id}>
            {abbrev(id)}…
          </option>
        ))}
      </select>
    </label>
  );
}
