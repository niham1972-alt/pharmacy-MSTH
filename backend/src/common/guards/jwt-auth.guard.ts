import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Verifies the Supabase-issued JWT on every request.
 *
 * Supports both signing schemes Supabase can issue, chosen per-token by the
 * `alg` in the JWT header:
 *   - HS256  → legacy shared-secret verification against SUPABASE_JWT_SECRET
 *              (Settings > API > "JWT Secret").
 *   - ES256/RS256 → asymmetric "JWT Signing Keys" (the current default for new
 *              projects). Public keys are fetched from the project's JWKS
 *              endpoint and matched by `kid`. Keys are cached in-process.
 *
 * The JWKS URL defaults to `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` and
 * can be overridden with SUPABASE_JWKS_URL. Downstream (AuthenticatedUser shape,
 * guards, decorators) is identical regardless of scheme.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private jwksClient: JwksClient | null = null;

  constructor(private readonly config: ConfigService) {}

  private getJwksClient(): JwksClient {
    if (this.jwksClient) {
      return this.jwksClient;
    }

    const explicit = this.config.get<string>('SUPABASE_JWKS_URL');
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const jwksUri =
      explicit ||
      (supabaseUrl
        ? `${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`
        : undefined);

    if (!jwksUri) {
      throw new UnauthorizedException('Auth is not configured on the server');
    }

    this.jwksClient = new JwksClient({
      jwksUri,
      cache: true,
      cacheMaxAge: 10 * 60 * 1000, // 10 minutes
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
    return this.jwksClient;
  }

  private async verify(token: string): Promise<JwtPayload> {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const alg = decoded.header.alg;

    // Legacy symmetric scheme.
    if (alg === 'HS256') {
      const secret = this.config.get<string>('SUPABASE_JWT_SECRET');
      if (!secret) {
        throw new UnauthorizedException('Auth is not configured on the server');
      }
      return jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;
    }

    // Asymmetric scheme (Supabase JWT Signing Keys).
    if (alg === 'ES256' || alg === 'RS256') {
      const kid = decoded.header.kid;
      if (!kid) {
        throw new UnauthorizedException('Token is missing a key id');
      }
      const signingKey = await this.getJwksClient().getSigningKey(kid);
      const publicKey = signingKey.getPublicKey();
      return jwt.verify(token, publicKey, {
        algorithms: ['ES256', 'RS256'],
      }) as JwtPayload;
    }

    throw new UnauthorizedException(`Unsupported token algorithm: ${alg}`);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = authHeader.slice('Bearer '.length).trim();

    let payload: JwtPayload;
    try {
      payload = await this.verify(token);
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload.app_metadata?.role || !payload.app_metadata?.pharmacyId) {
      throw new UnauthorizedException('Token is missing required pharmacy claims');
    }

    // Module 16 syncs account status into the JWT claims. A suspended/deactivated
    // user's existing token is cut off on its next request (staleness bounded by
    // the token's own TTL; suspend/deactivate also revokes the refresh token).
    const status = (payload.app_metadata as { status?: string }).status;
    if (status === 'SUSPENDED' || status === 'DEACTIVATED') {
      throw new UnauthorizedException(`Account is ${status.toLowerCase()}`);
    }

    const user: AuthenticatedUser = {
      userId: payload.sub,
      email: payload.email,
      role: payload.app_metadata.role,
      pharmacyId: payload.app_metadata.pharmacyId,
      branchId: payload.app_metadata.branchId,
      accessibleBranchIds: payload.app_metadata.accessibleBranchIds ?? [
        payload.app_metadata.branchId,
      ],
    };

    request.user = user;
    return true;
  }
}
