import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

const WINDOW_MS = 15 * 60_000;
const ACCOUNT_MAX = 5;
const IP_MAX = process.env.NODE_ENV === 'test' ? 100_000 : 100;

/**
 * Database-backed login lockout. The in-memory ThrottlerGuard is not enough
 * behind a proxy / multiple replicas because each request can land on
 * a fresh counter. Counting in Postgres makes the limit shared and durable.
 *
 * Per account: 5 failures in 15 minutes -> 429 until the window ends.
 * Per IP: 25 failures in 15 minutes (higher to avoid punishing shared NATs).
 */
@Injectable()
export class LoginThrottleService {
  constructor(private readonly prisma: PrismaService) {}

  async recordFailure(
    email: string,
    ip: string,
    surface: 'customer' | 'admin',
  ): Promise<{ blocked: boolean }> {
    const account = await this.bump(this.accountKey(email, surface), ACCOUNT_MAX, `login_${surface}_account`);
    const address = await this.bump(this.ipKey(ip, surface), IP_MAX, `login_${surface}_ip`);
    return { blocked: account || address };
  }

  /** A correct password clears the account counter; IP failures are retained. */
  async recordSuccess(email: string, surface: 'customer' | 'admin'): Promise<void> {
    await this.prisma.otpRateLimit.deleteMany({ where: { key: this.accountKey(email, surface) } });
  }

  private accountKey(email: string, surface: string) {
    return `login:${surface}:email:${email.trim().toLowerCase()}`;
  }

  private ipKey(ip: string, surface: string) {
    return `login:${surface}:ip:${ip || 'unknown'}`;
  }

  /** Atomically advances a key's window and returns its persisted block state. */
  private async bump(key: string, max: number, category: string): Promise<boolean> {
    const now = new Date();
    const expiredBefore = new Date(now.getTime() - WINDOW_MS);
    const rows = await this.prisma.$queryRaw<Array<{ count: number; blockedUntil: Date | null }>>(Prisma.sql`
      INSERT INTO "OtpRateLimit" AS rate_limit
        ("id", "key", "category", "count", "windowStartedAt", "lastAttemptAt", "blockedUntil", "createdAt", "updatedAt")
      VALUES
        (${randomUUID()}, ${key}, ${category}, 1, ${now}, ${now}, NULL, ${now}, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "category" = EXCLUDED."category",
        "count" = CASE
          WHEN rate_limit."windowStartedAt" <= ${expiredBefore} THEN 1
          WHEN rate_limit."blockedUntil" > ${now} THEN LEAST(rate_limit."count" + 1, ${max + 1})
          ELSE rate_limit."count" + 1
        END,
        "windowStartedAt" = CASE
          WHEN rate_limit."windowStartedAt" <= ${expiredBefore} THEN ${now}
          ELSE rate_limit."windowStartedAt"
        END,
        "lastAttemptAt" = ${now},
        "blockedUntil" = CASE
          WHEN rate_limit."windowStartedAt" <= ${expiredBefore} THEN NULL
          WHEN rate_limit."blockedUntil" > ${now} THEN rate_limit."blockedUntil"
          WHEN rate_limit."count" + 1 >= ${max} THEN rate_limit."windowStartedAt" + (${WINDOW_MS} * INTERVAL '1 millisecond')
          ELSE NULL
        END,
        "updatedAt" = ${now}
      RETURNING "count", "blockedUntil"
    `);
    const row = rows[0];
    return !!row && row.count > max && !!row.blockedUntil && row.blockedUntil > now;
  }

  private tooMany() {
    return new HttpException('Too many login attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }
}
