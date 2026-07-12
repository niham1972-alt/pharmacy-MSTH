import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PlatformStaff } from './platform-staff.interface';

export const CurrentPlatformStaff = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): PlatformStaff => ctx.switchToHttp().getRequest().platformStaff as PlatformStaff,
);
