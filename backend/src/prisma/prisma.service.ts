import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
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
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
