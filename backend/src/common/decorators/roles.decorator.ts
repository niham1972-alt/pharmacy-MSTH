import { SetMetadata } from '@nestjs/common';
import { PharmacyRole } from '../interfaces/jwt-payload.interface';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: PharmacyRole[]) => SetMetadata(ROLES_KEY, roles);
