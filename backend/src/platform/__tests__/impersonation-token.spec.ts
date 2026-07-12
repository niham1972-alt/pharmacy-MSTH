import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { ImpersonationTokenClaims, isImpersonationPayload, signImpersonationToken } from '../../common/auth/impersonation-token';

const config = new ConfigService({ IMPERSONATION_JWT_SECRET: 'test-secret-abc' });

const baseClaims: ImpersonationTokenClaims = {
  sub: 'target-auth-user',
  email: 'cashier@tenant.com',
  app_metadata: { role: 'cashier', pharmacyId: 'pharm-A', branchId: 'br-1', accessibleBranchIds: ['br-1'], status: 'ACTIVE' },
  typ: 'impersonation',
  impersonatedBy: 'staff-1',
  impersonationSessionId: 'sess-1',
};

describe('impersonation token', () => {
  it('embeds BOTH the impersonated identity claims AND the real staff impersonatedBy claim', () => {
    const token = signImpersonationToken(config, baseClaims, 1800);
    const decoded = jwt.verify(token, 'test-secret-abc') as ImpersonationTokenClaims;
    // impersonated identity — Modules 1–18 function as this tenant user
    expect(decoded.sub).toBe('target-auth-user');
    expect(decoded.app_metadata.pharmacyId).toBe('pharm-A');
    expect(decoded.app_metadata.role).toBe('cashier');
    // platform accountability — the real actor, signed (tamper-evident)
    expect(decoded.impersonatedBy).toBe('staff-1');
    expect(decoded.impersonationSessionId).toBe('sess-1');
    expect(decoded.typ).toBe('impersonation');
  });

  it('enforces a hard expiry independent of activity', () => {
    const token = signImpersonationToken(config, baseClaims, 1800);
    const decoded = jwt.decode(token) as { iat: number; exp: number };
    expect(decoded.exp - decoded.iat).toBe(1800);
  });

  it('fails verification if the impersonatedBy claim is tampered with (signature breaks)', () => {
    const token = signImpersonationToken(config, baseClaims, 1800);
    const [h, p, s] = token.split('.');
    const forged = JSON.parse(Buffer.from(p, 'base64url').toString());
    forged.impersonatedBy = 'attacker';
    const forgedPayload = Buffer.from(JSON.stringify(forged)).toString('base64url');
    expect(() => jwt.verify(`${h}.${forgedPayload}.${s}`, 'test-secret-abc')).toThrow();
  });

  it('isImpersonationPayload distinguishes impersonation tokens from normal ones', () => {
    expect(isImpersonationPayload(baseClaims)).toBe(true);
    expect(isImpersonationPayload({ sub: 'x', app_metadata: { role: 'admin', pharmacyId: 'p' } })).toBe(false);
    expect(isImpersonationPayload({ typ: 'impersonation' })).toBe(false); // missing impersonatedBy
    expect(isImpersonationPayload(null)).toBe(false);
  });
});
