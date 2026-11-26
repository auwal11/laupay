import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { OrderStatus, Prisma, UserStatus, WalletStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

export interface RiskContext {
  userId: string;
  kind: 'airtime' | 'data' | 'wallet_funding';
  amount: number;
  phoneNumber?: string;
}

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Lightweight, deterministic risk engine. Every decision and every rule
 * trigger is written to RiskEvent so ops can audit automated blocks.
 *
 * This is intentionally rule-based (not ML): it is meant to stop obvious
 * abuse — repeated failures, destination blacklists, daily velocity — and to
 * give the admin console real signals to display.
 */
@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async record(input: {
    userId?: string | null;
    type: string;
    severity?: 'info' | 'warning' | 'critical';
    decision?: string;
    amount?: number;
    metadata?: Record<string, unknown>;
  }) {
    try {
      return await this.prisma.riskEvent.create({
        data: {
          userId: input.userId ?? null,
          type: input.type,
          severity: input.severity ?? 'info',
          decision: input.decision,
          amount: input.amount !== undefined ? input.amount : undefined,
          metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        },
      });
    } catch (err) {
      this.logger.warn(`Could not record risk event ${input.type}: ${String(err)}`);
      return null;
    }
  }

  /**
   * Throws ForbiddenException when a transaction must not proceed, and writes
   * a RiskEvent explaining which rule fired.
   */
  async assertCanTransact(
    ctx: RiskContext,
    database: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const user = await database.user.findUnique({
      where: { id: ctx.userId },
      include: { walletAccount: true },
    });
    if (!user) throw new ForbiddenException('Account not found');

    if (user.status !== UserStatus.ACTIVE) {
      await this.record({
        userId: user.id,
        type: 'ACCOUNT_NOT_ACTIVE',
        severity: 'warning',
        decision: 'reject',
        metadata: { status: user.status, kind: ctx.kind },
      });
      throw new ForbiddenException('Your account is not active. Please contact support.');
    }

    if (user.walletAccount && user.walletAccount.status !== WalletStatus.ACTIVE) {
      await this.record({
        userId: user.id,
        type: 'WALLET_NOT_ACTIVE',
        severity: 'warning',
        decision: 'reject',
        metadata: { status: user.walletAccount.status, kind: ctx.kind },
      });
      throw new ForbiddenException('Your wallet is not available for transactions. Please contact support.');
    }

    if (ctx.kind !== 'wallet_funding' && ctx.phoneNumber) {
      if (await this.settings.isPhoneBlacklisted(ctx.phoneNumber)) {
        await this.record({
          userId: user.id,
          type: 'BLACKLISTED_DESTINATION',
          severity: 'critical',
          decision: 'reject',
          metadata: { phoneNumber: ctx.phoneNumber, kind: ctx.kind },
        });
        throw new ForbiddenException('This destination number cannot receive purchases.');
      }
    }

    if (ctx.kind === 'wallet_funding') return;

    const maxOrders = await this.settings.getNumber('risk_max_orders_per_day');
    const maxAmount = await this.settings.getNumber('risk_max_amount_per_day');
    const maxFailures = await this.settings.getNumber('risk_max_failed_tx_per_hour');

    const dayStart = startOfDay();
    const [todayCount, todayAgg] = await Promise.all([
      database.order.count({ where: { userId: user.id, createdAt: { gte: dayStart } } }),
      database.order.aggregate({
        where: { userId: user.id, createdAt: { gte: dayStart }, status: { not: OrderStatus.CANCELLED } },
        _sum: { amount: true },
      }),
    ]);
    const todayAmount = Number(todayAgg._sum.amount ?? 0);

    if (maxOrders > 0 && todayCount >= maxOrders) {
      await this.record({
        userId: user.id,
        type: 'DAILY_ORDER_LIMIT',
        severity: 'warning',
        decision: 'reject',
        metadata: { todayCount, maxOrders, kind: ctx.kind },
      });
      throw new ForbiddenException('Daily transaction limit reached. Please try again tomorrow.');
    }

    if (maxAmount > 0 && todayAmount + ctx.amount > maxAmount) {
      await this.record({
        userId: user.id,
        type: 'DAILY_AMOUNT_LIMIT',
        severity: 'warning',
        decision: 'reject',
        amount: ctx.amount,
        metadata: { todayAmount, maxAmount, kind: ctx.kind },
      });
      throw new ForbiddenException('Daily spending limit reached. Please try again tomorrow.');
    }

    if (maxFailures > 0) {
      const failed = await database.order.count({
        where: {
          userId: user.id,
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
          status: {
            in: [
              OrderStatus.FULFILLMENT_FAILED,
              OrderStatus.REFUNDED,
              OrderStatus.CANCELLED,
            ],
          },
        },
      });
      if (failed >= maxFailures) {
        await this.record({
          userId: user.id,
          type: 'FAILED_TX_VELOCITY',
          severity: 'critical',
          decision: 'reject',
          metadata: { failed, maxFailures, kind: ctx.kind },
        });
        throw new ForbiddenException('Too many failed transactions. Please contact support.');
      }
    }
  }

  async topEventsToday(limit = 10) {
    return this.prisma.riskEvent.findMany({
      where: { createdAt: { gte: startOfDay() } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
  }

  async listEvents(q: { severity?: string; type?: string; userId?: string; page?: number; pageSize?: number }) {
    const where: Prisma.RiskEventWhereInput = {};
    if (q.severity) where.severity = q.severity;
    if (q.type) where.type = q.type;
    if (q.userId) where.userId = q.userId;
    const take = Math.min(Math.max(q.pageSize ?? 25, 1), 100);
    const skip = (Math.max(q.page ?? 1, 1) - 1) * take;
    const [total, items] = await Promise.all([
      this.prisma.riskEvent.count({ where }),
      this.prisma.riskEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { user: { select: { id: true, email: true, fullName: true } } },
      }),
    ]);
    return { total, page: q.page ?? 1, pageSize: take, items };
  }
}
