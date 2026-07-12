import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { JwtVerifierService } from '../auth/jwt-verifier.service';
import { TenantStatusService } from '../auth/tenant-status.service';

/**
 * Verifies the JWT on every tenant-facing request (via the shared
 * JwtVerifierService — Supabase HS256/ES256/RS256, or a backend-issued
 * impersonation token) and attaches `AuthenticatedUser` to `req.user`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly verifier: JwtVerifierService,
    private readonly tenantStatus: TenantStatusService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = authHeader.slice('Bearer '.length).trim();

    let payload: JwtPayload;
    try {
      payload = await this.verifier.verify(token);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload.app_metadata?.role || !payload.app_metadata?.pharmacyId) {
      throw new UnauthorizedException('Token is missing required pharmacy claims');
    }

    // Module 16 syncs account status into the JWT claims. A suspended/deactivated
    // user's existing token is cut off on its next request.
    const status = (payload.app_metadata as { status?: string }).status;
    if (status === 'SUSPENDED' || status === 'DEACTIVATED') {
      throw new UnauthorizedException(`Account is ${status.toLowerCase()}`);
    }

    // Platform-level tenant suspension/archival blocks every user under that
    // pharmacy immediately, tenant-wide (independent of per-user JWT claims).
    const tenantBlocked = await this.tenantStatus.blockedStatus(payload.app_metadata.pharmacyId);
    if (tenantBlocked) {
      throw new ForbiddenException({ errorCode: 'TENANT_' + tenantBlocked, message: `This pharmacy account is ${tenantBlocked.toLowerCase()}.` });
    }

    const impersonatedBy = (payload as { impersonatedBy?: string }).impersonatedBy;
    const impersonationSessionId = (payload as { impersonationSessionId?: string }).impersonationSessionId;

    const user: AuthenticatedUser = {
      userId: payload.sub,
      email: payload.email,
      role: payload.app_metadata.role,
      pharmacyId: payload.app_metadata.pharmacyId,
      branchId: payload.app_metadata.branchId,
      accessibleBranchIds: payload.app_metadata.accessibleBranchIds ?? [payload.app_metadata.branchId],
      ...(impersonatedBy ? { impersonatedBy, impersonationSessionId } : {}),
    };

    request.user = user;
    // NOTE: the impersonation ALS context is bound in TenantIsolationMiddleware
    // (wrapping next() in AsyncLocalStorage.run) — the reliable propagation point
    // to Module 15's audit writes. See tenant-isolation.middleware.ts.
    return true;
  }
}
