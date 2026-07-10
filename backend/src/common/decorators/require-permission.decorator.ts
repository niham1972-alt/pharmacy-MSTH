import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

/**
 * Gate a handler on a resolved EFFECTIVE permission (role defaults + per-user
 * grants − revokes), not raw role membership. Enforced by `PermissionsGuard`,
 * which reads the requester's cached effective-permission set (Module 16).
 */
export const RequirePermission = (permissionKey: string) => SetMetadata(REQUIRE_PERMISSION_KEY, permissionKey);
