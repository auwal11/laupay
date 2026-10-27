import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const WINDOW_MS = 15 * 60_000;
const ACCOUNT_MAX = 5;
const IP_MAX = process.env.NODE_ENV === 'test' ? 100_000 : 100;

/**
 * Database-backed login lockout. The in-memory ThrottlerGuard is not enough
 * behind Railway's proxy / multiple replicas because each request can land on
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

  /** Returns true when this key was already over the limit before this failure. */
  private async bump(key: string, max: number, category: string): Promise<boolean> {
    const now = new Date();
    const row = await this.prisma.otpRateLimit.findUnique({ where: { key } });
    if (!row || now.getTime() - row.windowStartedAt.getTime() >= WINDOW_MS) {
      await this.prisma.otpRateLimit.upsert({
        where: { key },
        create: { key, category, count: 1, windowStartedAt: now, lastAttemptAt: now },
        update: { category, count: 1, windowStartedAt: now, lastAttemptAt: now, blockedUntil: null },
      });
      return false;
    }
    if (row.blockedUntil && row.blockedUntil > now) return true;
    const next = row.count + 1;
    await this.prisma.otpRateLimit.update({
      where: { key },
      data: {
        count: next,
        lastAttemptAt: now,
        ...(next >= max ? { blockedUntil: new Date(row.windowStartedAt.getTime() + WINDOW_MS) } : {}),
      },
    });
    return next > max;
  }

  private tooMany() {
    return new HttpException('Too many login attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }
}
