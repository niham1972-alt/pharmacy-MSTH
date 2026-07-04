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

  if (user.accessibleBranchIds.length <= 1) {
    return <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Branch: {user.branchId}</span>;
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-gray-500 dark:text-gray-400">Branch</span>
      <select
        value={branchId ?? user.branchId}
        onChange={(e) => setBranchId(e.target.value)}
        className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
      >
        {user.accessibleBranchIds.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
    </label>
  );
}
