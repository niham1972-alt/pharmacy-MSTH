import { PlatformRole } from '@prisma/client';

/** Attached to `req.platformStaff` by PlatformAuthGuard. A DELIBERATELY separate
 *  identity from the tenant-facing AuthenticatedUser — platform staff have no
 *  pharmacyId and operate across tenants. */
export interface PlatformStaff {
  id: string; // PlatformStaffUser.id
  authUserId: string;
  email: string;
  name: string;
  role: PlatformRole;
}
