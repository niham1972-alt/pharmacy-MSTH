import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PrismaService');

  constructor() {
    // Default interactive-transaction budget. The cross-module sale/GRN
    // transactions (Module 6 FEFO → per-batch Module 5 stock ledger writes) make
    // many round-trips; over the Supabase Session Pooler's latency the 5s default
    // is too tight. Overridable via env for slower links / heavier carts.
    super({
      transactionOptions: {
        maxWait: Number(process.env.PRISMA_TX_MAX_WAIT_MS ?? 10_000),
        timeout: Number(process.env.PRISMA_TX_TIMEOUT_MS ?? 30_000),
      },
    });
  }

  async onModuleInit(): Promise<void> {
    // Do NOT crash the whole app if the DB is momentarily unreachable at boot
    // (e.g. a transient Supabase pooler blip / network hiccup). Prisma reconnects
    // lazily on the first query, so the server still starts, /api/health responds,
    // and requests recover automatically once connectivity returns.
    try {
      await this.$connect();
      this.logger.log('Connected to the database.');
    } catch (err) {
      this.logger.error(`Initial DB connection failed (will retry lazily per request): ${(err as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
