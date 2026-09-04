import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentStatus, VtuTransactionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { VtuService } from '../vtu/vtu.service';

/**
 * Implements the reconciliation routine described in
 * docs/architecture/payment-flow.md §3 and docs/architecture/vtu-flow.md §3.
 *
 * A payment/VTU transaction left in PROCESSING or UNKNOWN is NOT a failure —
 * it means we don't yet know the provider's authoritative outcome. This job
 * periodically requeries the provider for every such stuck record and lets
 * the existing idempotent PaymentsService/VtuService requery methods apply
 * whatever the provider's real status turns out to be.
 *
 * Because requeryPayment()/requeryTransaction() and the underlying
 * LedgerService credit/debit calls are idempotent, running this job on a
 * short interval and possibly overlapping with a webhook resolving the same
 * record is safe — whichever path gets there first wins, and the other
 * becomes a no-op.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  /** How long a record may sit in PROCESSING/UNKNOWN before we requery it. */
  private readonly staleThresholdMs = 2 * 60 * 1000; // 2 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly vtuService: VtuService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    await this.runOnce();
  }

  /**
   * Exposed separately from the @Cron handler so it can also be triggered
   * on demand (see AdminController) — useful for tests and for manually
   * resolving a specific incident without waiting for the next tick.
   */
  async runOnce(): Promise<{ paymentsChecked: number; vtuChecked: number }> {
    const cutoff = new Date(Date.now() - this.staleThresholdMs);

    const stalePayments = await this.prisma.payment.findMany({
      where: {
        status: { in: [PaymentStatus.PROCESSING, PaymentStatus.UNKNOWN] },
        updatedAt: { lt: cutoff },
      },
      take: 100,
    });

    for (const payment of stalePayments) {
      try {
        const before = payment.status;
        const result = await this.paymentsService.requeryPayment(payment.id);
        if (result.status !== before) {
          this.logger.log(
            `Reconciled payment ${payment.id}: ${before} -> ${result.status}`,
          );
        }
      } catch (err) {
        this.logger.error(`Failed to reconcile payment ${payment.id}: ${err}`);
      }
    }

    const staleVtu = await this.prisma.vtuTransaction.findMany({
      where: {
        status: { in: [VtuTransactionStatus.PROCESSING, VtuTransactionStatus.UNKNOWN] },
        updatedAt: { lt: cutoff },
      },
      take: 100,
    });

    for (const txn of staleVtu) {
      try {
        const before = txn.status;
        const result = await this.vtuService.requeryTransaction(txn.id);
        if (result.status !== before) {
          this.logger.log(`Reconciled VTU transaction ${txn.id}: ${before} -> ${result.status}`);
        }
      } catch (err) {
        this.logger.error(`Failed to reconcile VTU transaction ${txn.id}: ${err}`);
      }
    }

    if (stalePayments.length || staleVtu.length) {
      this.logger.log(
        `Reconciliation pass: checked ${stalePayments.length} payment(s), ${staleVtu.length} VTU transaction(s)`,
      );
    }

    return { paymentsChecked: stalePayments.length, vtuChecked: staleVtu.length };
  }
}
