import { BadRequestException, Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { MockWebhookVerifier } from './verifiers/webhook-verifier.interface';
import { PaymentsService } from '../payments/payments.service';
import { OrdersService } from '../orders/orders.service';

/**
 * See docs/architecture/payment-flow.md §4. Every inbound provider event:
 *   1. Has its signature verified before anything else.
 *   2. Is recorded (append-only) in PaymentEvent, keyed uniquely by
 *      (provider, providerEventId) — a duplicate delivery is detected and
 *      short-circuited here, before it even reaches the ledger.
 *   3. Only then triggers the same idempotent LedgerService credit path
 *      used elsewhere — belt-and-braces duplicate protection.
 */
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('webhooks')
export class WebhooksController {
  private readonly verifier = new MockWebhookVerifier();

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly ordersService: OrdersService,
  ) {}

  @Post('payment')
  async handlePaymentWebhook(
    @Req() req: Request,
    @Headers('x-webhook-signature') signature: string | undefined,
    @Body() body: { providerEventId: string; providerReference: string; status: string },
  ) {
    const rawBody = JSON.stringify(body);
    if (!this.verifier.verify(rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { providerReference: body.providerReference },
    });
    if (!payment) throw new BadRequestException('Unknown payment reference');

    try {
      await this.prisma.paymentEvent.create({
        data: {
          paymentId: payment.id,
          provider: 'mock',
          providerEventId: body.providerEventId,
          rawPayload: body,
        },
      });
    } catch (err) {
      if (this.isDuplicateEvent(err)) {
        return { status: 'ignored_duplicate' };
      }
      throw err;
    }

    await this.paymentsService.requeryPayment(payment.id);
    return { status: 'processed' };
  }

  /**
   * VTU provider webhook (delivery confirmation for airtime/data
   * fulfillment). Delegates to OrdersService.reconcileVtuTransaction, which
   * is the single place (shared with the reconciliation job and the
   * original synchronous fulfillment call) that translates a VTU outcome
   * into an Order status update and reverses the wallet debit on FAILED —
   * see docs/decisions/0003-phase1-hardening-review.md Remaining Risk #2
   * (now closed) and OrdersService.applyVtuOutcome.
   *
   * Known gap (unchanged from the hardening pass): there is no
   * VtuTransactionEvent table for duplicate-delivery dedup the way
   * PaymentEvent provides for the payment webhook — this relies on
   * VtuService.requeryTransaction / OrdersService.reconcileVtuTransaction
   * being idempotent by construction instead. See
   * docs/decisions/0003-phase1-hardening-review.md Remaining Risk #1.
   */
  @Post('vtu')
  async handleVtuWebhook(
    @Headers('x-webhook-signature') signature: string | undefined,
    @Body() body: { providerReference: string; status: string },
  ) {
    const rawBody = JSON.stringify(body);
    if (!this.verifier.verify(rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const txn = await this.prisma.vtuTransaction.findUnique({
      where: { providerReference: body.providerReference },
    });
    if (!txn) throw new BadRequestException('Unknown VTU transaction reference');

    await this.ordersService.reconcileVtuTransaction(txn.id);
    return { status: 'processed' };
  }

  private isDuplicateEvent(err: unknown): boolean {
    return !!(err && typeof err === 'object' && 'code' in err && (err as any).code === 'P2002');
  }
}
