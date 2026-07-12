import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtVerifierService } from '../../common/auth/jwt-verifier.service';
import { PlatformStaff } from './platform-staff.interface';

/**
 * Authenticates PLATFORM requests. Verifies the Supabase JWT (shared verifier),
 * then requires the token's user to exist as a `PlatformStaffUser` — a separate
 * identity space from tenant `User`s. A tenant user (even an `admin`) can never
 * pass this guard, and an impersonation token is explicitly rejected here (no
 * escalating from impersonation back up to the platform layer).
 */
@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(
    private readonly verifier: JwtVerifierService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException('Missing or malformed Authorization header');

    let payload;
    try {
      payload = await this.verifier.verify(authHeader.slice('Bearer '.length).trim());
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Impersonation tokens must never grant platform access.
    if ((payload as { typ?: string }).typ === 'impersonation') {
      throw new ForbiddenException({ errorCode: 'PLATFORM_ACCESS_DENIED', message: 'Impersonation tokens cannot access the platform layer.' });
    }

    const authUserId = payload.sub;
    const staff = await this.prisma.platformStaffUser.findUnique({ where: { authUserId } });
    if (!staff) {
      throw new ForbiddenException({ errorCode: 'NOT_PLATFORM_STAFF', message: 'This account is not a platform staff member.' });
    }
    if (staff.status !== 'ACTIVE') {
      throw new ForbiddenException({ errorCode: 'PLATFORM_STAFF_INACTIVE', message: `Platform staff account is ${staff.status.toLowerCase()}.` });
    }

    const platformStaff: PlatformStaff = { id: staff.id, authUserId: staff.authUserId, email: staff.email, name: staff.name, role: staff.role };
    request.platformStaff = platformStaff;
    return true;
  }
}
