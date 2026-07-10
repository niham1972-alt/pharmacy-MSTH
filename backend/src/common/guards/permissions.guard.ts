import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { AuthorizationService } from '../../modules/users/authorization.service';
import { ROLE_ENUM, permissionsForRoles } from '../../modules/users/config/permission-matrix.config';

/**
 * Enforces `@RequirePermission('key')` against a user's EFFECTIVE permissions
 * (role defaults + per-user grants − revokes), resolved and cached by
 * AuthorizationService. Runs after JwtAuthGuard (needs `req.user`). Handlers with
 * no `@RequirePermission` are unaffected — roles stay the default gate elsewhere.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authz: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<string>(REQUIRE_PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!key) return true;

    const user: AuthenticatedUser | undefined = context.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException({ errorCode: 'PERMISSION_DENIED', message: 'Not authenticated.' });

    const eff = await this.authz.getEffectivePermissionsByAuth(user.userId);
    let allowed: boolean;
    if (eff) {
      allowed = eff.isSuperAdmin || eff.effective.includes(key);
    } else {
      // Not a DB-backed user (e.g. a seed/system token) → fall back to the
      // claim role checked against the matrix, so baseline access still works.
      const role = ROLE_ENUM[user.role];
      allowed = user.role === 'super_admin' || (!!role && permissionsForRoles([role]).has(key));
    }
    if (!allowed) throw new ForbiddenException({ errorCode: 'PERMISSION_DENIED', message: `You don't have the "${key}" permission.` });
    return true;
  }
}
