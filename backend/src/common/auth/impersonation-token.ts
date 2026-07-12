import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

/**
 * Impersonation tokens are backend-issued, HS256-signed, short-lived JWTs — a
 * DELIBERATELY distinct token type from a normal Supabase user session. They
 * carry the impersonated tenant user's claims (so Modules 1–18 work normally)
 * PLUS a signed `impersonatedBy` claim and a `typ: 'impersonation'` marker that
 * makes the impersonation context tamper-evident (part of the signature, never a
 * client-supplied header).
 */
export interface ImpersonationTokenClaims {
  sub: string; // impersonated tenant user id
  email?: string;
  app_metadata: {
    role: string;
    pharmacyId: string;
    branchId: string;
    accessibleBranchIds: string[];
    status: 'ACTIVE';
  };
  typ: 'impersonation';
  impersonatedBy: string; // platform staff user id
  impersonationSessionId: string;
}

/** Resolve the HS256 secret used for impersonation tokens. Prefers a dedicated
 *  secret; falls back to other stable server secrets so dev works without extra
 *  env wiring. Sign + verify happen in the same process so this is consistent. */
export function impersonationSecret(config: ConfigService): string {
  const secret =
    config.get<string>('IMPERSONATION_JWT_SECRET') ||
    config.get<string>('SUPABASE_JWT_SECRET') ||
    config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) throw new Error('No secret available to sign impersonation tokens (set IMPERSONATION_JWT_SECRET).');
  return secret;
}

export function signImpersonationToken(config: ConfigService, claims: ImpersonationTokenClaims, expiresInSeconds: number): string {
  return jwt.sign(claims, impersonationSecret(config), { algorithm: 'HS256', expiresIn: expiresInSeconds });
}

/** True if a decoded JWT payload is (claims to be) an impersonation token. */
export function isImpersonationPayload(payload: unknown): payload is ImpersonationTokenClaims & { iat: number; exp: number } {
  return !!payload && typeof payload === 'object' && (payload as { typ?: string }).typ === 'impersonation' && typeof (payload as { impersonatedBy?: string }).impersonatedBy === 'string';
}
