import { Global, Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { StepUpAuthController } from './step-up-auth.controller';
import { UsersService } from './users.service';
import { AuthorizationService } from './authorization.service';
import { StepUpAuthService } from './step-up-auth.service';
import { SupabaseAdminService } from './supabase-admin.service';
import { UserEventsEmitter } from './events/user-events.emitter';

/**
 * Module 16 — the security foundation. @Global so `AuthorizationService`
 * (permission-key checks + claims computation) is injectable anywhere. The
 * canonical per-request role guard remains `common/guards/roles.guard.ts`
 * (already imported by every module); this module is authoritative for what the
 * JWT claims that guard reads SHOULD contain, and pushes them to Supabase Auth.
 */
@Global()
@Module({
  controllers: [UsersController, StepUpAuthController],
  providers: [UsersService, AuthorizationService, StepUpAuthService, SupabaseAdminService, UserEventsEmitter],
  exports: [AuthorizationService, UsersService],
})
export class UsersModule {}
