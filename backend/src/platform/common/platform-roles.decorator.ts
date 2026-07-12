import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRole } from '@prisma/client';
import { PlatformStaff } from './platform-staff.interface';

export const PLATFORM_ROLES_KEY = 'platformRoles';

/** Restrict a platform route to the given PlatformRole(s). Deliberately a
 *  DIFFERENT enum + guard from the tenant-facing @Roles/RolesGuard — the two role
 *  systems must never be conflated. */
export const PlatformRoles = (...roles: PlatformRole[]) => SetMetadata(PLATFORM_ROLES_KEY, roles);

@Injectable()
export class PlatformRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PlatformRole[]>(PLATFORM_ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) return true;
    const staff = context.switchToHttp().getRequest().platformStaff as PlatformStaff | undefined;
    if (!staff || !required.includes(staff.role)) {
      throw new ForbiddenException({ errorCode: 'PLATFORM_ROLE_DENIED', message: `Requires platform role: ${required.join(' or ')}.` });
    }
    return true;
  }
}
