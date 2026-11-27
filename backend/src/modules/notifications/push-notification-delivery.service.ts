import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpoPushHttpError, ExpoPushProvider, ExpoPushReceipt, ExpoPushTicket } from './expo-push.provider';

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 8;
const RECEIPT_DELAY_MS = 15 * 60_000;
const RECEIPT_RETRY_MS = 5 * 60_000;
const RECEIPT_MAX_AGE_MS = 23 * 60 * 60_000;
const LOCK_LEASE_MS = 2 * 60_000;

@Injectable()
export class PushNotificationDeliveryService {
  private readonly logger = new Logger(PushNotificationDeliveryService.name);
  private sending = false;
  private checkingReceipts = false;

  constructor(private readonly prisma: PrismaService, private readonly expo: ExpoPushProvider) {}

  @Interval(15_000)
  async processDueDeliveries(): Promise<void> {
    if (this.sending) return;
    this.sending = true;
    try {
      const rows = await this.claimDeliveries();
      for (const row of rows) await this.deliver(row.id);
    } catch (error) {
      this.logger.error(`Push delivery batch failed: ${safeErrorName(error)}`);
    } finally {
      this.sending = false;
    }
  }

  @Interval(60_000)
  async processDueReceipts(): Promise<void> {
    if (this.checkingReceipts) return;
    this.checkingReceipts = true;
    try {
      const rows = await this.claimReceipts();
      if (rows.length === 0) return;
      const deliveries = await this.prisma.notificationPushDelivery.findMany({
        where: { id: { in: rows.map((row) => row.id) } },
        select: { id: true, ticketId: true, ticketedAt: true, pushTokenId: true },
      });
      const ticketIds = deliveries.flatMap((row) => row.ticketId ? [row.ticketId] : []);
      let receipts: Record<string, ExpoPushReceipt | undefined>;
      try {
        receipts = await this.expo.getReceipts(ticketIds);
      } catch {
        await this.deferReceiptChecks(deliveries.map((row) => row.id));
        return;
      }
      for (const delivery of deliveries) {
        const receipt = delivery.ticketId ? receipts[delivery.ticketId] : undefined;
        await this.applyReceipt(delivery, receipt);
      }
    } catch (error) {
      this.logger.error(`Push receipt batch failed: ${safeErrorName(error)}`);
    } finally {
      this.checkingReceipts = false;
    }
  }

  private async claimDeliveries(): Promise<Array<{ id: string }>> {
    return this.prisma.$transaction((tx) => tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH due AS (
        SELECT "id"
        FROM "NotificationPushDelivery"
        WHERE (
          ("status" = 'PENDING' AND "nextAttemptAt" <= NOW())
          OR ("status" = 'PROCESSING' AND "lockedAt" < NOW() - INTERVAL '2 minutes')
        )
        ORDER BY "createdAt" ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "NotificationPushDelivery" AS delivery
      SET "status" = 'PROCESSING',
          "lockedAt" = NOW(),
          "attempts" = delivery."attempts" + 1,
          "updatedAt" = NOW()
      FROM due
      WHERE delivery."id" = due."id"
      RETURNING delivery."id"
    `));
  }

  private async claimReceipts(): Promise<Array<{ id: string }>> {
    return this.prisma.$transaction((tx) => tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH due AS (
        SELECT "id"
        FROM "NotificationPushDelivery"
        WHERE (
          ("status" = 'TICKETED' AND "receiptDueAt" <= NOW())
          OR ("status" = 'RECEIPT_PROCESSING' AND "lockedAt" < NOW() - INTERVAL '2 minutes')
        )
        ORDER BY "receiptDueAt" ASC NULLS FIRST
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "NotificationPushDelivery" AS delivery
      SET "status" = 'RECEIPT_PROCESSING',
          "lockedAt" = NOW(),
          "updatedAt" = NOW()
      FROM due
      WHERE delivery."id" = due."id"
      RETURNING delivery."id"
    `));
  }

  private async deliver(id: string): Promise<void> {
    const delivery = await this.prisma.notificationPushDelivery.findUnique({
      where: { id },
      include: { pushToken: true, notification: { select: { id: true, userId: true } } },
    });
    if (!delivery) return;
    if (!delivery.pushToken.isActive || delivery.pushToken.userId !== delivery.notification.userId) {
      await this.prisma.notificationPushDelivery.update({
        where: { id }, data: { status: 'FAILED', lockedAt: null, lastError: 'Push token is no longer active for this account.' },
      });
      return;
    }

    try {
      const ticket = await this.expo.send(delivery.pushToken.expoPushToken, delivery.notificationId);
      if (ticket.status === 'error') {
        await this.handlePushError(id, delivery.pushTokenId, ticket.details?.error ?? 'ExpoRejected', delivery.attempts);
        return;
      }
      if (!ticket.id) {
        await this.markForReview(id, 'Expo accepted no receipt ticket identifier.');
        return;
      }
      const now = new Date();
      await this.prisma.notificationPushDelivery.update({
        where: { id },
        data: {
          status: 'TICKETED', ticketId: ticket.id, ticketedAt: now,
          receiptDueAt: new Date(now.getTime() + RECEIPT_DELAY_MS), lockedAt: null, lastError: null,
        },
      });
    } catch (error) {
      const retryable = !(error instanceof ExpoPushHttpError) || error.status === 429 || error.status >= 500;
      if (!retryable) {
        await this.markForReview(id, `Expo request rejected (HTTP ${error.status}).`);
        return;
      }
      await this.scheduleRetry(id, delivery.attempts, 'Expo push service request failed temporarily.');
    }
  }

  private async handlePushError(id: string, tokenId: string, code: string, attempts: number): Promise<void> {
    if (code === 'DeviceNotRegistered') {
      await this.prisma.notificationPushToken.updateMany({
        where: { id: tokenId, isActive: true }, data: { isActive: false, revokedAt: new Date() },
      });
      await this.prisma.notificationPushDelivery.update({
        where: { id }, data: { status: 'FAILED', lockedAt: null, lastError: 'Expo reported that the device is not registered.' },
      });
      return;
    }
    if (code === 'MessageRateExceeded') {
      await this.scheduleRetry(id, attempts, 'Expo rate limit temporarily exceeded.');
      return;
    }
    await this.markForReview(id, `Expo rejected the push request (${safeProviderCode(code)}).`);
  }

  private async applyReceipt(
    delivery: { id: string; ticketedAt: Date | null; pushTokenId: string },
    receipt: ExpoPushReceipt | undefined,
  ): Promise<void> {
    if (!receipt) {
      const age = Date.now() - (delivery.ticketedAt?.getTime() ?? Date.now());
      if (age >= RECEIPT_MAX_AGE_MS) {
        await this.markForReview(delivery.id, 'Expo receipt was not available before it expired.');
      } else {
        await this.prisma.notificationPushDelivery.update({
          where: { id: delivery.id },
          data: { status: 'TICKETED', receiptDueAt: new Date(Date.now() + RECEIPT_RETRY_MS), lockedAt: null },
        });
      }
      return;
    }
    if (receipt.status === 'ok') {
      await this.prisma.notificationPushDelivery.update({
        where: { id: delivery.id },
        data: { status: 'SENT', receiptCheckedAt: new Date(), receiptDueAt: null, lockedAt: null, lastError: null },
      });
      return;
    }
    const code = receipt.details?.error ?? 'ExpoReceiptError';
    if (code === 'DeviceNotRegistered') {
      await this.prisma.notificationPushToken.updateMany({
        where: { id: delivery.pushTokenId, isActive: true }, data: { isActive: false, revokedAt: new Date() },
      });
      await this.prisma.notificationPushDelivery.update({
        where: { id: delivery.id },
        data: { status: 'FAILED', receiptCheckedAt: new Date(), receiptDueAt: null, lockedAt: null, lastError: 'Expo receipt reports an unregistered device.' },
      });
      return;
    }
    await this.markForReview(delivery.id, `Expo receipt reported an error (${safeProviderCode(code)}).`);
  }

  private async deferReceiptChecks(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.notificationPushDelivery.updateMany({
      where: { id: { in: ids }, status: 'RECEIPT_PROCESSING' },
      data: { status: 'TICKETED', receiptDueAt: new Date(Date.now() + RECEIPT_RETRY_MS), lockedAt: null, lastError: 'Receipt service temporarily unavailable.' },
    });
  }

  private async scheduleRetry(id: string, attempts: number, reason: string): Promise<void> {
    if (attempts >= MAX_ATTEMPTS) {
      await this.markForReview(id, 'Push delivery retry limit reached.');
      return;
    }
    const delay = Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 30 * 60_000);
    await this.prisma.notificationPushDelivery.update({
      where: { id },
      data: { status: 'PENDING', nextAttemptAt: new Date(Date.now() + delay), lockedAt: null, lastError: reason },
    });
  }

  private async markForReview(id: string, reason: string): Promise<void> {
    await this.prisma.notificationPushDelivery.update({
      where: { id }, data: { status: 'REVIEW', lockedAt: null, receiptDueAt: null, lastError: reason },
    });
    this.logger.error(`Push delivery ${id} requires manual review.`);
  }
}

function safeErrorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

function safeProviderCode(code: string): string {
  return /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(code) ? code : 'UnknownProviderError';
}
