import { Injectable } from '@nestjs/common';
import { TenantStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Resolves a tenant's (Pharmacy) access status, cached briefly so the auth hot
 * path isn't a DB round-trip per request. Used by JwtAuthGuard to block ALL
 * requests for a SUSPENDED/ARCHIVED tenant immediately and tenant-wide — a single
 * enforcement point that doesn't depend on re-syncing every user's JWT claims.
 */
@Injectable()
export class TenantStatusService {
  private readonly cache = new Map<string, { status: TenantStatus | 'UNKNOWN'; ts: number }>();
  private readonly TTL = 30_000;

  constructor(private readonly prisma: PrismaService) {}

  /** Returns the blocking status (SUSPENDED | ARCHIVED) or null if the tenant may proceed. */
  async blockedStatus(pharmacyId: string): Promise<TenantStatus | null> {
    const cached = this.cache.get(pharmacyId);
    let status: TenantStatus | 'UNKNOWN';
    if (cached && Date.now() - cached.ts < this.TTL) {
      status = cached.status;
    } else {
      const row = await this.prisma.pharmacy.findUnique({ where: { id: pharmacyId }, select: { status: true } });
      status = row?.status ?? 'UNKNOWN'; // UNKNOWN = tenant not yet registered in platform layer → allow (back-compat)
      this.cache.set(pharmacyId, { status, ts: Date.now() });
    }
    return status === 'SUSPENDED' || status === 'ARCHIVED' ? status : null;
  }

  invalidate(pharmacyId: string): void {
    this.cache.delete(pharmacyId);
  }
}
