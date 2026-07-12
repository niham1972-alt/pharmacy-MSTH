import { Global, Module } from '@nestjs/common';
import { TenantsController } from './tenants/tenants.controller';
import { TenantsService } from './tenants/tenants.service';
import { SubscriptionPlansController } from './subscription-plans/subscription-plans.controller';
import { SubscriptionPlansService } from './subscription-plans/subscription-plans.service';
import { ImpersonationController } from './impersonation/impersonation.controller';
import { ImpersonationService } from './impersonation/impersonation.service';
import { PlatformDashboardController } from './dashboard/platform-dashboard.controller';
import { PlatformDashboardService } from './dashboard/platform-dashboard.service';
import { PlatformStaffController } from './platform-staff/platform-staff.controller';
import { PlatformStaffService } from './platform-staff/platform-staff.service';
import { AnnouncementsController } from './announcements/announcements.controller';
import { AnnouncementsService } from './announcements/announcements.service';
import { FeatureFlagsController } from './feature-flags/feature-flags.controller';
import { FeatureFlagsService } from './feature-flags/feature-flags.service';
import { TenantConfigController } from './tenant-config.controller';
import { PlanLimitsService } from './plan-limits/plan-limits.service';
import { PlatformAuditService } from './common/platform-audit.service';
import { PlatformAuthGuard } from './common/platform-auth.guard';
import { PlatformRolesGuard } from './common/platform-roles.decorator';

/**
 * The Super-Admin / multi-tenant platform layer — a deliberately separate module
 * tree from src/modules (Modules 1–18). @Global so `PlanLimitsService` is
 * injectable by Module 16's user-invite flow (plan-limit soft gate) without a
 * circular import. Every platform controller is guarded by PlatformAuthGuard +
 * PlatformRolesGuard (PlatformStaffUser identity space), NOT the tenant guards.
 */
@Global()
@Module({
  controllers: [
    TenantsController,
    SubscriptionPlansController,
    ImpersonationController,
    PlatformDashboardController,
    PlatformStaffController,
    AnnouncementsController,
    FeatureFlagsController,
    TenantConfigController,
  ],
  providers: [
    PlatformAuditService,
    TenantsService,
    SubscriptionPlansService,
    ImpersonationService,
    PlatformDashboardService,
    PlatformStaffService,
    AnnouncementsService,
    FeatureFlagsService,
    PlanLimitsService,
    PlatformAuthGuard,
    PlatformRolesGuard,
  ],
  exports: [PlanLimitsService],
})
export class PlatformModule {}
