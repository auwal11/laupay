import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // Interactive transactions default to 5s, which is too short for a WAN
  // round-trip to a managed Postgres (Supabase's PgBouncer pooler). Raised once
  // here so every caller inherits it without touching business logic.
  private static readonly TX_TIMEOUT_MS = 30_000;

  /** Options for an interactive transaction, sized for remote databases. */
  static txOptions() {
    return { timeout: PrismaService.TX_TIMEOUT_MS, maxWait: PrismaService.TX_TIMEOUT_MS };
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
