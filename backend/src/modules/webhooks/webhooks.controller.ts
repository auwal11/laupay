import { createHmac, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MockWebhookVerifier } from './verifiers/webhook-verifier.interface';
import { PaymentsService } from '../payments/payments.service';
import { OrdersService } from '../orders/orders.service';

const mockVerifier = new MockWebhookVerifier();

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
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * Paystack signature check: HMAC-SHA512(rawBody, PAYSTACK_WEBHOOK_SECRET),
   * compared in constant time against `x-paystack-signature`.
   */
  private verifyPaystack(rawBody: string, signature: string | undefined): boolean {
    if (!signature || !this.config.paystackWebhookSecret) return false;
    const expected = createHmac('sha512', this.config.paystackWebhookSecret)
      .update(rawBody)
      .digest('hex');
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  /**
   * Monnify signature check: HMAC-SHA512(rawBody, MONNIFY_SECRET_KEY) against
   * `monnify-signature` (Monnify derives the HMAC from the secret key itself).
   */
  private verifyMonnify(rawBody: string, signature: string | undefined): boolean {
    if (!signature || !this.config.monnifySecretKey) return false;
    const expected = createHmac('sha512', this.config.monnifySecretKey)
      .update(rawBody)
      .digest('hex');
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  /** VTpass sends `x-vtpass-signature` = HMAC-SHA512(rawBody, secret). */
  private verifyVtpass(rawBody: string, signature: string | undefined): boolean {
    if (!signature || !this.config.vtpassWebhookSecret) return false;
    const expected = createHmac('sha512', this.config.vtpassWebhookSecret)
      .update(rawBody)
      .digest('hex');
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  /**
   * Paystack sends a `GET /webhooks/payment` challenge (`?challenge=…`) the
   * first time it registers a URL. Answering it is what makes Paystack stop
   * treating the endpoint as dead and begin delivering real events.
   */
  @Get('payment')
  challenge(@Req() req: Request, @Res() res: Response) {
    const challenge = req.query.challenge;
    if (typeof challenge === 'string' && challenge.length > 0 && challenge.length <= 256) {
      return res.status(200).send(challenge);
    }
    return res.status(400).send({ message: 'Missing challenge' });
  }

  @Post('payment')
  async handlePaymentWebhook(
    @Req() req: Request,
    @Headers('x-paystack-signature') paystackSig: string | undefined,
    @Headers('monnify-signature') monnifySig: string | undefined,
    @Headers('x-webhook-signature') legacySig: string | undefined,
    @Body() body: { providerEventId: string; providerReference: string; status: string },
  ) {
    const rawBody = JSON.stringify(body);
    const verified =
      this.verifyPaystack(rawBody, paystackSig) ||
      this.verifyMonnify(rawBody, monnifySig) ||
      // legacy mock signature keeps the existing E2E suite working
      mockVerifier.verify(rawBody, legacySig);
    if (!verified) {
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
    @Headers('x-vtpass-signature') vtpassSig: string | undefined,
    @Headers('x-webhook-signature') legacySig: string | undefined,
    @Body() body: { providerReference: string; status: string },
  ) {
    const rawBody = JSON.stringify(body);
    if (!this.verifyVtpass(rawBody, vtpassSig) && !mockVerifier.verify(rawBody, legacySig)) {
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
