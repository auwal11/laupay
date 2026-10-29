import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
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
import { VirtualAccountsService } from '../payments/virtual-accounts.service';

const mockVerifier = new MockWebhookVerifier();

type RawBodyRequest = Request & { rawBody?: Buffer };

interface PaystackWebhook {
  event?: string;
  data?: { id?: string | number; reference?: string; status?: string };
}

interface MonnifyWebhook {
  eventType?: string;
  eventData?: {
    paymentReference?: string;
    transactionReference?: string;
    paymentStatus?: string;
    amountPaid?: number;
    currency?: string;
    accountReference?: string;
    product?: { type?: string; reference?: string };
    destinationAccountInformation?: { accountNumber?: string; bankName?: string };
  };
}

interface VtpassCallback {
  type?: string;
  data?: {
    requestId?: string;
    content?: { transactions?: { transactionId?: string; status?: string } };
  };
}

interface VtuAgentCallback {
  event?: string;
  reference?: string;
  status?: string;
  hash?: string;
  timestamp?: string;
}

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
    private readonly virtualAccounts: VirtualAccountsService,
  ) {}

  /**
   * Paystack signature check: HMAC-SHA512(rawBody, PAYSTACK_WEBHOOK_SECRET),
   * compared in constant time against `x-paystack-signature`.
   */
  private verifyPaystack(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature || !this.config.paystackWebhookSecret) return false;
    const expected = createHmac('sha512', this.config.paystackWebhookSecret)
      .update(rawBody)
      .digest('hex');
    const actual = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    return actual.length === expectedBuffer.length && timingSafeEqual(expectedBuffer, actual);
  }

  /**
   * Monnify signature check: HMAC-SHA512(rawBody, MONNIFY_SECRET_KEY) against
   * `monnify-signature` (Monnify derives the HMAC from the secret key itself).
   */
  private verifyMonnify(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature || !this.config.monnifySecretKey) return false;
    const expected = createHmac('sha512', this.config.monnifySecretKey)
      .update(rawBody)
      .digest('hex');
    const actual = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    return actual.length === expectedBuffer.length && timingSafeEqual(expectedBuffer, actual);
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
    @Req() req: RawBodyRequest,
    @Headers('x-paystack-signature') paystackSig: string | undefined,
    @Headers('monnify-signature') monnifySig: string | undefined,
    @Headers('x-webhook-signature') legacySig: string | undefined,
    @Body() body: PaystackWebhook & MonnifyWebhook,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Missing raw request body');
    const paystackVerified = this.verifyPaystack(rawBody, paystackSig);
    const monnifyVerified = this.verifyMonnify(rawBody, monnifySig);
    // legacy mock signature keeps the existing E2E suite working
    const legacyVerified =
      this.config.nodeEnv !== 'production' && mockVerifier.verify(rawBody.toString('utf8'), legacySig);
    if (!paystackVerified && !monnifyVerified && !legacyVerified) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Monnify delivers a `{ eventType, eventData }` envelope whose signature is
    // HMAC-SHA512(rawBody, MONNIFY_SECRET_KEY) in `monnify-signature`.
    if (monnifyVerified && (body.eventType || body.eventData)) {
      const monnifyBody = body as MonnifyWebhook;
      if (monnifyBody.eventData?.product?.type === 'RESERVED_ACCOUNT') {
        return this.handleReservedAccountDeposit(monnifyBody);
      }
      return this.handleMonnifyPayment(monnifyBody);
    }

    const providerReference = body.data?.reference;
    const providerEventId = body.data?.id != null ? `${body.event ?? 'paystack'}:${body.data.id}` : `${body.event ?? 'paystack'}:${providerReference ?? ''}`;
    if (!body.event || !providerReference || !providerEventId || providerEventId.endsWith(':')) {
      throw new BadRequestException('Invalid Paystack event payload');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { providerReference },
    });
    if (!payment) throw new BadRequestException('Unknown payment reference');

    try {
      await this.prisma.paymentEvent.create({
        data: {
          paymentId: payment.id,
          provider: 'paystack',
          providerEventId,
          rawPayload: body as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (this.isDuplicateEvent(err)) {
        return { status: 'ignored_duplicate' };
      }
      throw err;
    }

    // Do not trust data.status from the callback. The provider adapter
    // re-queries Paystack and only that verified result can credit the wallet.
    void this.paymentsService.requeryPayment(payment.id).catch(() => undefined);
    return { status: 'accepted' };
  }

  /**
   * Monnify transaction-completion webhook. Uses the same append-only
   * PaymentEvent dedup and the same requery-before-credit discipline as the
   * Paystack path — the callback's own status is never trusted.
   */
  private async handleMonnifyPayment(body: MonnifyWebhook) {
    const transactionReference = body.eventData?.transactionReference;
    const paymentReference = body.eventData?.paymentReference;
    const providerReference = transactionReference ?? paymentReference;
    const providerEventId = transactionReference ?? paymentReference;
    if (!body.eventType || !providerReference || !providerEventId) {
      throw new BadRequestException('Invalid Monnify event payload');
    }

    // MonnifyPaymentProvider stores its own transactionReference as the payment
    // providerReference; fall back to the paymentReference for older/partial
    // payloads so neither lookup misses a legitimate event.
    const payment =
      (await this.prisma.payment.findUnique({ where: { providerReference: providerReference } })) ??
      (paymentReference
        ? await this.prisma.payment.findFirst({ where: { providerReference: paymentReference } })
        : null);
    if (!payment) throw new BadRequestException('Unknown payment reference');

    try {
      await this.prisma.paymentEvent.create({
        data: {
          paymentId: payment.id,
          provider: 'monnify',
          providerEventId: `${body.eventType}:${providerEventId}`,
          rawPayload: body as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (this.isDuplicateEvent(err)) {
        return { status: 'ignored_duplicate' };
      }
      throw err;
    }

    void this.paymentsService.requeryPayment(payment.id).catch(() => undefined);
    return { status: 'accepted' };
  }

  /**
   * Bank transfer into a customer's Monnify reserved account. The signature is
   * already verified above; the credit itself is idempotent on the provider
   * transaction reference, so webhook retries cannot duplicate a deposit.
   */
  private async handleReservedAccountDeposit(body: MonnifyWebhook) {
    const event = body.eventData;
    if (body.eventType !== 'SUCCESSFUL_TRANSACTION' || !event) {
      return { status: 'ignored_event' };
    }
    const status = (event.paymentStatus ?? '').toUpperCase();
    if (status && !['PAID', 'SUCCESS', 'SUCCESSFUL', 'OVERPAID'].includes(status)) {
      return { status: 'ignored_status' };
    }
    const currency = (event.currency ?? 'NGN').toUpperCase();
    if (currency !== 'NGN') throw new BadRequestException('Unsupported deposit currency');

    const account = await this.virtualAccounts.findForEvent({
      productReference: event.product?.reference,
      accountReference: event.accountReference,
      paymentReference: event.paymentReference,
      accountNumber: event.destinationAccountInformation?.accountNumber,
    });
    if (!account) throw new BadRequestException('Unknown deposit account');

    const transactionReference = event.transactionReference ?? event.paymentReference;
    if (!transactionReference) throw new BadRequestException('Missing deposit reference');

    return this.paymentsService.creditReservedAccountDeposit({
      userId: account.userId,
      amount: Number(event.amountPaid),
      transactionReference,
      accountReference: account.accountReference,
      raw: body as unknown,
    });
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
    @Body() body: VtpassCallback,
  ) {
    if (!body.type || !body.data) throw new BadRequestException('Invalid VTpass callback payload');
    if (body.type !== 'transaction-update') return { response: 'success' };

    const providerReference = body.data.content?.transactions?.transactionId;
    if (!providerReference) throw new BadRequestException('Missing VTpass transactionId');
    // We store our own request_id as the VtuTransaction providerReference (that
    // is what VTpass re-query keys on), so the provider's transactionId from
    // the callback is matched against the raw payload as a fallback.
    const txn =
      (await this.prisma.vtuTransaction.findUnique({ where: { providerReference } })) ??
      (await this.prisma.vtuTransaction.findFirst({
        where: {
          rawResponse: { path: ['content', 'transactions', 'transactionId'], equals: providerReference },
        },
      }));
    if (!txn) throw new BadRequestException('Unknown VTU transaction reference');

    // VTpass documents no signing header/secret. Never trust its status field;
    // reconcileVtuTransaction re-queries the provider before changing state.
    void this.ordersService.reconcileVtuTransaction(txn.id).catch(() => undefined);
    return { response: 'success' };
  }

  /**
   * VTUAgent callback. Its documented authenticity proof is SHA-256 of
   * "{API key}:{request_ref}" in the body hash (not an HTTP signature header).
   * The callback status is never trusted for wallet/order state; reconciliation
   * re-queries VTUAgent before applying the outcome.
   */
  @Post('vtuagent')
  async handleVtuAgentWebhook(@Body() body: VtuAgentCallback) {
    if (!this.config.vtuAgentEnabled || !this.config.vtuAgentApiKey || !body.reference || !body.hash || !/^[a-f0-9]{64}$/.test(body.hash)) {
      throw new BadRequestException('Invalid VTUAgent callback payload');
    }
    const expected = createHash('sha256')
      .update(`${this.config.vtuAgentApiKey}:${body.reference}`)
      .digest('hex');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const actualBuffer = Buffer.from(body.hash, 'utf8');
    if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
      throw new BadRequestException('Invalid VTUAgent callback signature');
    }

    const txn = await this.prisma.vtuTransaction.findUnique({ where: { providerReference: body.reference } });
    if (!txn) throw new BadRequestException('Unknown VTUAgent transaction reference');
    void this.ordersService.reconcileVtuTransaction(txn.id).catch(() => undefined);
    return { response: 'success' };
  }

  private isDuplicateEvent(err: unknown): boolean {
    return !!(err && typeof err === 'object' && 'code' in err && (err as any).code === 'P2002');
  }
}
