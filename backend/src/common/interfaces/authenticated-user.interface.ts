import { PharmacyRole } from './jwt-payload.interface';

/** Shape attached to `req.user` by JwtAuthGuard for the rest of the request lifecycle. */
export interface AuthenticatedUser {
  userId: string;
  email?: string;
  role: PharmacyRole;
  pharmacyId: string;
  branchId: string;
  accessibleBranchIds: string[];
  /** Set only when this request runs under a platform impersonation token —
   *  the real platform-staff user id acting as this tenant user. */
  impersonatedBy?: string;
  impersonationSessionId?: string;
}
