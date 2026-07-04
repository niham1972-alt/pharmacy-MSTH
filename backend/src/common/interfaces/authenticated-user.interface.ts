import { PharmacyRole } from './jwt-payload.interface';

/** Shape attached to `req.user` by JwtAuthGuard for the rest of the request lifecycle. */
export interface AuthenticatedUser {
  userId: string;
  email?: string;
  role: PharmacyRole;
  pharmacyId: string;
  branchId: string;
  accessibleBranchIds: string[];
}
