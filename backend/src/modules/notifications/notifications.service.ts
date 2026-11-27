import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { enqueueNotificationPushDeliveries } from './push-delivery-queue';

export interface CreateNotificationInput {
  userId: string;
  category?: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

/**
 * Materialised user notification feed. Used for test-credit grants, purchase
 * results and system messages. Read state is per-row so the UI can show an
 * unread badge. Writes here never affect money — the ledger is the source of
 * truth for balances.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput) {
    return this.prisma.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: {
          userId: input.userId,
          category: input.category ?? 'account',
          title: input.title,
          body: input.body,
          metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        },
      });
      await enqueueNotificationPushDeliveries(tx, input.userId, notification.id);
      return notification;
    });
  }

  async registerPushToken(userId: string, token: string, platform: 'android' | 'ios') {
    const current = await this.prisma.notificationPushToken.findUnique({
      where: { expoPushToken: token },
      select: { id: true, userId: true, isActive: true },
    });
    if (current?.isActive && current.userId !== userId) {
      throw new ConflictException('This push token is already registered to another account.');
    }
    if (current) {
      await this.prisma.notificationPushToken.update({
        where: { id: current.id },
        data: { userId, platform, isActive: true, revokedAt: null, lastRegisteredAt: new Date() },
      });
    } else {
      await this.prisma.notificationPushToken.create({ data: { userId, expoPushToken: token, platform } });
    }
    return { registered: true };
  }

  async unregisterPushToken(userId: string, token: string) {
    await this.prisma.notificationPushToken.updateMany({
      where: { userId, expoPushToken: token, isActive: true },
      data: { isActive: false, revokedAt: new Date() },
    });
    // Do not disclose whether this token belonged to this account.
    return { removed: true };
  }

  /** Fan-out a notification to every admin-console user (ops alerts). */
  async notifyAdmins(input: { title: string; body: string; category?: string; metadata?: Record<string, unknown> }) {
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPPORT', 'FINANCE', 'VIEWER'] }, status: 'ACTIVE' },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) =>
        this.create({
          userId: admin.id,
          category: input.category ?? 'system',
          title: input.title,
          body: input.body,
          metadata: input.metadata,
        }).catch(() => undefined),
      ),
    );
    return { notified: admins.length };
  }

  async list(userId: string, take = 50) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async unreadCount(userId: string) {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  async markRead(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      const exists = await this.prisma.notification.findFirst({ where: { id, userId } });
      if (!exists) throw new NotFoundException('Notification not found');
    }
    return { read: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { read: result.count };
  }
}
