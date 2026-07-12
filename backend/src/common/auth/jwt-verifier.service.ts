import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { impersonationSecret, isImpersonationPayload } from './impersonation-token';

/**
 * Shared JWT verification for every guard in the system (tenant-facing
 * JwtAuthGuard and the platform PlatformAuthGuard). Supports:
 *   - Supabase HS256 (legacy shared secret)
 *   - Supabase ES256/RS256 (asymmetric JWKS, current default)
 *   - Backend-issued HS256 impersonation tokens (`typ: 'impersonation'`)
 */
@Injectable()
export class JwtVerifierService {
  private jwksClient: JwksClient | null = null;

  constructor(private readonly config: ConfigService) {}

  private getJwksClient(): JwksClient {
    if (this.jwksClient) return this.jwksClient;
    const explicit = this.config.get<string>('SUPABASE_JWKS_URL');
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const jwksUri = explicit || (supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json` : undefined);
    if (!jwksUri) throw new UnauthorizedException('Auth is not configured on the server');
    this.jwksClient = new JwksClient({ jwksUri, cache: true, cacheMaxAge: 10 * 60 * 1000, rateLimit: true, jwksRequestsPerMinute: 10 });
    return this.jwksClient;
  }

  async verify(token: string): Promise<JwtPayload> {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') throw new UnauthorizedException('Invalid or expired token');
    const alg = decoded.header.alg;

    // Backend-issued impersonation token — verify against the impersonation secret.
    if (alg === 'HS256' && isImpersonationPayload(decoded.payload)) {
      return jwt.verify(token, impersonationSecret(this.config), { algorithms: ['HS256'] }) as JwtPayload;
    }

    if (alg === 'HS256') {
      const secret = this.config.get<string>('SUPABASE_JWT_SECRET');
      if (!secret) throw new UnauthorizedException('Auth is not configured on the server');
      return jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;
    }

    if (alg === 'ES256' || alg === 'RS256') {
      const kid = decoded.header.kid;
      if (!kid) throw new UnauthorizedException('Token is missing a key id');
      const publicKey = (await this.getJwksClient().getSigningKey(kid)).getPublicKey();
      return jwt.verify(token, publicKey, { algorithms: ['ES256', 'RS256'] }) as JwtPayload;
    }

    throw new UnauthorizedException(`Unsupported token algorithm: ${alg}`);
  }
}
