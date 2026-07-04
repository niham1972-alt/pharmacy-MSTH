import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';

/**
 * Never trust a `branchId` query param on its own — always cross-check it
 * against the authenticated user's `accessibleBranchIds` claim (spec §13/§17).
 * Returns the effective branchId to query with (falls back to the user's home branch).
 */
export function resolveBranchScope(user: AuthenticatedUser, requestedBranchId?: string): string {
  const branchId = requestedBranchId ?? user.branchId;

  if (!user.accessibleBranchIds.includes(branchId)) {
    throw new ForbiddenException({
      errorCode: 'BRANCH_ACCESS_DENIED',
      message: `You do not have access to branch ${branchId}`,
    });
  }

  return branchId;
}
