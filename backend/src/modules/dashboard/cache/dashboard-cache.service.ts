import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Thin wrapper over ioredis for the dashboard's aggregate-query cache.
 * Redis is optional (spec §15/§0): when REDIS_ENABLED is not "true", or the
 * connection fails, every method silently no-ops (pass-through to the
 * caller/DB) instead of throwing — the module must degrade gracefully.
 */
@Injectable()
export class DashboardCacheService implements OnModuleDestroy {
  private readonly logger = new Logger('DashboardCache');
  private client: Redis | null = null;
  private readonly enabled: boolean;
  private warnedOnce = false;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<string>('REDIS_ENABLED') === 'true';

    if (this.enabled) {
      const url = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
      this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
      this.client.on('error', (err) => this.warnOnce(err));
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      this.warnOnce(err as Error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.warnOnce(err as Error);
    }
  }

  /** Deletes all keys matching a `pattern` (e.g. `dash:{pharmacyId}:{branchId}:*`). */
  async invalidate(pattern: string): Promise<void> {
    if (!this.client) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length) {
        await this.client.del(...keys);
      }
    } catch (err) {
      this.warnOnce(err as Error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
    }
  }

  private warnOnce(err: Error): void {
    if (!this.warnedOnce) {
      this.warnedOnce = true;
      this.logger.warn(`Redis unavailable, caching disabled for this run: ${err.message}`);
    }
  }
}
