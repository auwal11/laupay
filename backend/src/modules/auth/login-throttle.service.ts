import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const WINDOW_MS = 15 * 60_000;
const ACCOUNT_MAX = 5;
const IP_MAX = 100;

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

  async assertAllowed(email: string, ip: string, surface: 'customer' | 'admin'): Promise<void> {
    await this.assertKey(this.accountKey(email, surface), ACCOUNT_MAX);
    await this.assertKey(this.ipKey(ip, surface), IP_MAX);
  }

  async recordFailure(email: string, ip: string, surface: 'customer' | 'admin'): Promise<void> {
    await this.bump(this.accountKey(email, surface), ACCOUNT_MAX, `login_${surface}_account`);
    await this.bump(this.ipKey(ip, surface), IP_MAX, `login_${surface}_ip`);
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

  private async assertKey(key: string, max: number) {
    const now = new Date();
    const row = await this.prisma.otpRateLimit.findUnique({ where: { key } });
    if (!row) return;
    if (row.blockedUntil && row.blockedUntil > now) throw this.tooMany();
    if (now.getTime() - row.windowStartedAt.getTime() >= WINDOW_MS) return;
    if (row.count >= max) {
      await this.prisma.otpRateLimit.update({
        where: { key },
        data: { blockedUntil: new Date(row.windowStartedAt.getTime() + WINDOW_MS) },
      });
      throw this.tooMany();
    }
  }

  private async bump(key: string, max: number, category: string) {
    const now = new Date();
    const row = await this.prisma.otpRateLimit.findUnique({ where: { key } });
    if (!row || now.getTime() - row.windowStartedAt.getTime() >= WINDOW_MS) {
      await this.prisma.otpRateLimit.upsert({
        where: { key },
        create: { key, category, count: 1, windowStartedAt: now, lastAttemptAt: now },
        update: { category, count: 1, windowStartedAt: now, lastAttemptAt: now, blockedUntil: null },
      });
      return;
    }
    const next = row.count + 1;
    await this.prisma.otpRateLimit.update({
      where: { key },
      data: {
        count: next,
        lastAttemptAt: now,
        ...(next >= max ? { blockedUntil: new Date(row.windowStartedAt.getTime() + WINDOW_MS) } : {}),
      },
    });
  }

  private tooMany() {
    return new HttpException('Too many login attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }
}
