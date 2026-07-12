import { Global, Module } from '@nestjs/common';
import { JwtVerifierService } from './jwt-verifier.service';
import { TenantStatusService } from './tenant-status.service';

/** @Global so both the tenant JwtAuthGuard and the platform PlatformAuthGuard
 *  share a single JWT verifier (one JWKS cache, one impersonation-token path) and
 *  the cached tenant-status enforcement. */
@Global()
@Module({
  providers: [JwtVerifierService, TenantStatusService],
  exports: [JwtVerifierService, TenantStatusService],
})
export class JwtVerifierModule {}
