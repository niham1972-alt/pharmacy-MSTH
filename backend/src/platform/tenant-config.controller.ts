import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../common/interceptors/response-envelope.interceptor';
import { AnnouncementsService } from './announcements/announcements.service';
import { FeatureFlagsService } from './feature-flags/feature-flags.service';

/**
 * TENANT-FACING platform surface (guarded by the normal tenant JwtAuthGuard, NOT
 * the platform guard). Exposes only what a pharmacy legitimately needs from the
 * platform layer: the live announcement banner(s), the feature flags resolved for
 * their own pharmacy, and (when the request runs under an impersonation token) the
 * impersonation context that drives the mandatory ImpersonationBanner. It reveals
 * nothing about other tenants or the platform's internals.
 */
@Controller('platform/tenant-config')
@UseGuards(JwtAuthGuard)
export class TenantConfigController {
  constructor(private readonly announcements: AnnouncementsService, private readonly flags: FeatureFlagsService) {}

  @Get()
  async config(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    const [announcements, featureFlags] = await Promise.all([
      this.announcements.active(),
      this.flags.resolveForPharmacy(user.pharmacyId),
    ]);
    return {
      data: {
        announcements,
        featureFlags,
        impersonation: user.impersonatedBy
          ? { active: true, impersonatedBy: user.impersonatedBy, impersonationSessionId: user.impersonationSessionId, viewingAsUserId: user.userId, pharmacyId: user.pharmacyId }
          : { active: false },
      },
      message: 'Tenant config fetched',
    };
  }
}
