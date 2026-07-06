import { createHmac } from 'crypto';

/**
 * Tamper-evidence hash-chain. Each record's hash = HMAC(secret, previousHash +
 * canonical content). A retroactive edit to any row (e.g. a direct DB tweak that
 * bypasses the app) changes that row's content hash, so it no longer matches the
 * `recordHash` stored on it AND breaks every subsequent link — detectable by the
 * integrity check. Chains are per-pharmacy. HMAC (keyed) rather than a plain hash
 * so an attacker who can edit rows can't also recompute a valid forward chain
 * without the server secret (AUDIT_HASH_SECRET).
 */
const SECRET = process.env.AUDIT_HASH_SECRET || 'dev-audit-hash-secret-change-in-prod';

export interface HashableContent {
  id: string;
  pharmacyId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  performedBy: string;
  severity: string;
  metadata: unknown;
  createdAt: Date;
}

export function computeRecordHash(previousHash: string | null, c: HashableContent): string {
  const canonical = [
    previousHash ?? '',
    c.id,
    c.pharmacyId,
    c.action,
    c.entityType,
    c.entityId ?? '',
    c.performedBy,
    c.severity,
    JSON.stringify(c.metadata ?? null),
    c.createdAt.toISOString(),
  ].join('|');
  return createHmac('sha256', SECRET).update(canonical).digest('hex');
}
