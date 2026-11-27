import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma, TransactionAlertOutbox } from '@prisma/client';
import { AppConfigService } from '../../config/app-config.service';
import { MAIL_PROVIDER, MailProvider } from '../../common/mail/mail-provider.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionAlertEmailPayload } from './transaction-alerts';

const BATCH_SIZE = 20;
const LOCK_LEASE_MS = 2 * 60 * 1000;
// Brevo's idempotency key is valid for 30 minutes; stop automatic retries
// before that window closes, so an ambiguous send is never blindly duplicated.
const SAFE_IDEMPOTENCY_WINDOW_MS = 25 * 60 * 1000;

@Injectable()
export class TransactionAlertDeliveryService {
  private readonly logger = new Logger(TransactionAlertDeliveryService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider,
  ) {}

  @Interval(10_000)
  async processDueAlerts(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.claimBatch();
      for (const row of rows) await this.deliver(row);
    } catch (error) {
      this.logger.error(`Transaction alert outbox batch failed: ${safeErrorName(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async claimBatch(): Promise<TransactionAlertOutbox[]> {
    return this.prisma.$transaction((tx) => tx.$queryRaw<TransactionAlertOutbox[]>(Prisma.sql`
      WITH queued AS (
        SELECT "id"
        FROM "TransactionAlertOutbox"
        WHERE (
          ("status" = 'PENDING' AND "nextAttemptAt" <= NOW())
          OR ("status" = 'PROCESSING' AND "lockedAt" < NOW() - INTERVAL '2 minutes')
        )
        ORDER BY "createdAt" ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "TransactionAlertOutbox" AS outbox
      SET "status" = 'PROCESSING',
          "lockedAt" = NOW(),
          "firstAttemptAt" = COALESCE(outbox."firstAttemptAt", NOW()),
          "attempts" = outbox."attempts" + 1,
          "updatedAt" = NOW()
      FROM queued
      WHERE outbox."id" = queued."id"
      RETURNING outbox.*
    `));
  }

  private async deliver(row: TransactionAlertOutbox): Promise<void> {
    if (this.config.isProduction && this.config.mailProvider !== 'brevo') {
      await this.markForReview(row.id, 'Transactional mail provider is not enabled in production.');
      return;
    }

    try {
      const payload = row.payload as unknown as TransactionAlertEmailPayload;
      await this.mail.sendTransactionAlert({
        to: row.recipientEmail,
        ...payload,
        // Outbox IDs are stable UUIDs, as required by Brevo's idempotency API.
        idempotencyKey: row.id,
      });
      await this.prisma.transactionAlertOutbox.update({
        where: { id: row.id },
        data: { status: 'SENT', sentAt: new Date(), lockedAt: null, lastError: null },
      });
    } catch (error) {
      const attemptStartedAt = row.firstAttemptAt?.getTime() ?? row.createdAt.getTime();
      const elapsed = Date.now() - attemptStartedAt;
      const retryDelay = Math.min(30_000 * 2 ** Math.max(0, row.attempts - 1), 5 * 60_000);
      if (elapsed + retryDelay >= SAFE_IDEMPOTENCY_WINDOW_MS) {
        await this.markForReview(row.id, 'Email delivery outcome is ambiguous; automatic retry window expired.');
        return;
      }

      await this.prisma.transactionAlertOutbox.update({
        where: { id: row.id },
        data: {
          status: 'PENDING',
          lockedAt: null,
          nextAttemptAt: new Date(Date.now() + retryDelay),
          lastError: `Email delivery attempt ${row.attempts} failed (${safeErrorName(error)}).`,
        },
      });
      this.logger.warn(`Transaction alert email retry scheduled for outbox ${row.id}.`);
    }
  }

  private async markForReview(id: string, reason: string): Promise<void> {
    await this.prisma.transactionAlertOutbox.update({
      where: { id },
      data: { status: 'REVIEW', lockedAt: null, lastError: reason },
    });
    this.logger.error(`Transaction alert outbox ${id} requires manual review.`);
  }
}

function safeErrorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}
