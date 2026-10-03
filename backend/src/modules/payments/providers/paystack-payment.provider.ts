import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service';
import {
  InitializePaymentRequest,
  PaymentProvider,
  ProviderPaymentResult,
} from './payment-provider.interface';

/**
 * Paystack TEST integration (requirement 8).
 *
 * SECURITY MODEL
 *  - The client only ever receives a `checkoutUrl` to open; the server owns
 *    the amount, the currency and every status decision.
 *  - `verifyTransaction` re-queries Paystack server-side using the secret key
 *    and is the ONLY thing allowed to mark a payment SUCCESS (requirement 9).
 *  - Webhooks additionally validate HMAC-SHA512 of the raw body against
 *    `PAYSTACK_WEBHOOK_SECRET` — see PaystackWebhookVerifier.
 *
 * This provider maps Paystack's `success|failed|abandoned|pending` onto the
 * project's PENDING/PROCESSING/SUCCESS/FAILED/UNKNOWN vocabulary. Anything we
 * cannot positively interpret becomes UNKNOWN — never FAILED — because UNKNOWN
 * routes into the reconciliation/requery path rather than a wrongful reversal.
 */
@Injectable()
export class PaystackPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(PaystackPaymentProvider.name);
  private readonly baseUrl = 'https://api.paystack.co';

  constructor(private readonly config: AppConfigService) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.paystackSecretKey}`,
      'Content-Type': 'application/json',
    };
  }

  async initialize(req: InitializePaymentRequest): Promise<ProviderPaymentResult> {
    const reference = `LAU_${req.idempotencyKey.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}`;

    const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        amount: Math.round(req.amount * 100), // kobo, server-computed
        currency: req.currency,
        reference,
        email: req.customerEmail,
        callback_url: req.metadata?.callbackUrl,
        metadata: { idempotencyKey: req.idempotencyKey, ...(req.metadata ?? {}) },
      }),
    });

    const body = (await response.json()) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string; access_code?: string; reference?: string };
    };

    if (!response.ok || !body.status) {
      this.logger.error(`Paystack initialize failed: ${response.status} ${body.message}`);
      // A provider-side rejection is not proof of failure of the payment —
      // we never created one. Treat as UNKNOWN so nothing is written off.
      return { status: 'UNKNOWN', providerReference: reference, raw: body };
    }

    this.logger.log(`Paystack checkout initialized: ${reference}`);
    return {
      status: 'PENDING',
      providerReference: reference,
      raw: { checkoutUrl: body.data?.authorization_url, accessCode: body.data?.access_code },
    };
  }

  async verifyTransaction(providerReference: string): Promise<ProviderPaymentResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/transaction/verify/${encodeURIComponent(providerReference)}`,
        { method: 'GET', headers: this.headers() },
      );
      const body = (await response.json()) as {
        status?: boolean;
        message?: string;
        data?: { status?: string; amount?: number; currency?: string; paid_at?: string };
      };

      if (!response.ok || !body.status || !body.data) {
        this.logger.warn(`Paystack verify inconclusive for ${providerReference}`);
        return { status: 'UNKNOWN', providerReference, raw: body };
      }

      const status = body.data.status;
      const mapped =
        status === 'success'
          ? 'SUCCESS'
          : status === 'failed' || status === 'reversed'
          ? 'FAILED'
          : status === 'abandoned' || status === 'pending' || status === 'ongoing'
          ? 'PENDING'
          : 'UNKNOWN';

      return { status: mapped, providerReference, raw: body.data };
    } catch (err) {
      // Network failure: UNKNOWN, so the reconciliation job requeries later.
      this.logger.error(`Paystack verify error for ${providerReference}: ${String(err)}`);
      return { status: 'UNKNOWN', providerReference };
    }
  }
}
