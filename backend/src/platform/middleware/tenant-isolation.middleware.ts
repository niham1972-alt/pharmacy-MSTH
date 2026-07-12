import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { impersonationStore } from '../../common/context/impersonation-context';
import { isImpersonationPayload } from '../../common/auth/impersonation-token';

/**
 * TENANT-ISOLATION MIDDLEWARE — the single most important piece of defense-in-depth
 * in the system.
 *
 * Multi-tenancy correctness rests on every Module 1–18 query being scoped by the
 * authenticated user's `pharmacyId`, which services derive from `req.user` (the
 * verified JWT claim) — NOT from client input. This middleware adds a second,
 * independent layer: it ASSERTS that no request to a tenant route carries a
 * `pharmacyId` (in body / query / params) that differs from the one the token
 * authorizes, and REJECTS (403) any that does. A cross-tenant access therefore
 * requires a deliberate bypass, never a silent oversight.
 *
 * It runs BEFORE guards, so it only *decodes* the token to read the claim for
 * comparison — the JwtAuthGuard still cryptographically verifies the signature.
 * Platform routes (`/api/platform/*`) are exempt: the platform layer is the only
 * part of the system permitted to operate across `pharmacyId` values.
 */

/** Pure, unit-testable core: collect every `pharmacyId` a client supplied and
 *  reject if any differs from the token's authorized pharmacy. */
export function assertNoForeignPharmacyId(authorizedPharmacyId: string | undefined, ...sources: unknown[]): void {
  if (!authorizedPharmacyId) return; // unauthenticated / no claim — guards will reject
  const provided = new Set<string>();
  for (const src of sources) collectPharmacyIds(src, provided, 0);
  for (const id of provided) {
    if (id && id !== authorizedPharmacyId) {
      throw new ForbiddenException({
        errorCode: 'CROSS_TENANT_DENIED',
        message: 'Request references a pharmacy other than the one your session authorizes.',
      });
    }
  }
}

function collectPharmacyIds(value: unknown, out: Set<string>, depth: number): void {
  if (value == null || depth > 6) return;
  if (Array.isArray(value)) {
    for (const v of value) collectPharmacyIds(v, out, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'pharmacyId' && typeof v === 'string') out.add(v);
      else collectPharmacyIds(v, out, depth + 1);
    }
  }
}

@Injectable()
export class TenantIsolationMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    // Platform routes legitimately cross tenants — exempt.
    if (req.path.startsWith('/api/platform') || req.path.startsWith('/platform')) return next();

    const authHeader = req.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) return next(); // no token → guard handles auth

    // Decode only (signature is verified by JwtAuthGuard). Read the authorized
    // pharmacyId claim (same field for normal + impersonation tokens).
    const decoded = jwt.decode(authHeader.slice('Bearer '.length).trim());
    const authorized = (decoded as { app_metadata?: { pharmacyId?: string } } | null)?.app_metadata?.pharmacyId;

    assertNoForeignPharmacyId(authorized, req.body, req.query, req.params);

    // If this is an impersonation token, bind the impersonation context for the
    // WHOLE downstream request (guards → handler → Module 15 audit) by wrapping
    // next() in AsyncLocalStorage.run — the reliable propagation point. (Safe to
    // read from the decoded token: an invalid signature is still rejected by the
    // JwtAuthGuard before any audit write occurs.)
    if (isImpersonationPayload(decoded)) {
      return impersonationStore.run({ impersonatedBy: decoded.impersonatedBy, impersonationSessionId: decoded.impersonationSessionId }, () => next());
    }
    next();
  }
}
