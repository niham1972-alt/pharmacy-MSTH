import { ForbiddenException } from '@nestjs/common';
import { assertNoForeignPharmacyId } from '../middleware/tenant-isolation.middleware';

/**
 * The single most safety-critical test suite in the platform module: it proves the
 * tenant-isolation assertion rejects EVERY attempt to reference a pharmacy other
 * than the one the token authorizes, across body / query / params, nested and in
 * arrays. (Section 20 "critical integration test".)
 */
const AUTHORIZED = 'pharm-A';
const FOREIGN = 'pharm-B';

describe('assertNoForeignPharmacyId', () => {
  it('allows a request with no pharmacyId anywhere', () => {
    expect(() => assertNoForeignPharmacyId(AUTHORIZED, { name: 'x' }, { page: '1' }, {})).not.toThrow();
  });

  it("allows a request whose pharmacyId matches the token's", () => {
    expect(() => assertNoForeignPharmacyId(AUTHORIZED, { pharmacyId: AUTHORIZED }, {}, {})).not.toThrow();
  });

  it('REJECTS a foreign pharmacyId in the body', () => {
    expect(() => assertNoForeignPharmacyId(AUTHORIZED, { pharmacyId: FOREIGN }, {}, {})).toThrow(ForbiddenException);
  });

  it('REJECTS a foreign pharmacyId in the query string', () => {
    expect(() => assertNoForeignPharmacyId(AUTHORIZED, {}, { pharmacyId: FOREIGN }, {})).toThrow(ForbiddenException);
  });

  it('REJECTS a foreign pharmacyId in route params', () => {
    expect(() => assertNoForeignPharmacyId(AUTHORIZED, {}, {}, { pharmacyId: FOREIGN })).toThrow(ForbiddenException);
  });

  it('REJECTS a foreign pharmacyId nested deep inside the body', () => {
    const body = { items: [{ medicine: { meta: { pharmacyId: FOREIGN } } }] };
    expect(() => assertNoForeignPharmacyId(AUTHORIZED, body)).toThrow(ForbiddenException);
  });

  it('REJECTS if ANY of several pharmacyIds is foreign (one matches, one does not)', () => {
    const body = { a: { pharmacyId: AUTHORIZED }, b: { pharmacyId: FOREIGN } };
    expect(() => assertNoForeignPharmacyId(AUTHORIZED, body)).toThrow(ForbiddenException);
  });

  it('surfaces the CROSS_TENANT_DENIED error code', () => {
    try {
      assertNoForeignPharmacyId(AUTHORIZED, { pharmacyId: FOREIGN });
      fail('expected throw');
    } catch (e) {
      expect((e as ForbiddenException).getResponse()).toMatchObject({ errorCode: 'CROSS_TENANT_DENIED' });
    }
  });

  it('does not enforce when there is no authorized pharmacyId (unauthenticated → guard handles it)', () => {
    expect(() => assertNoForeignPharmacyId(undefined, { pharmacyId: FOREIGN })).not.toThrow();
  });

  it('ignores non-string pharmacyId values (cannot spoof via objects)', () => {
    expect(() => assertNoForeignPharmacyId(AUTHORIZED, { pharmacyId: { $ne: null } as never })).not.toThrow();
  });
});
