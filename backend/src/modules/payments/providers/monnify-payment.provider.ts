import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service';
import {
  InitializePaymentRequest,
  PaymentProvider,
  ProviderPaymentResult,
} from './payment-provider.interface';

/**
 * Monnify SANDBOX integration (requirement 8) — the alternative to Paystack.
 *
 * Selected by PAYMENT_PROVIDER=monnify. Uses the reserved-account/reservation
 * model: `POST /api/v1/transactions/initialize` with the contract code, which
 * returns a checkout link for the customer.
 *
 * Amount is computed server-side from the request the service hands us, never
 * from anything the browser sent, and `verifyTransaction` re-queries Monnify
 * with a Bearer token minted from api-key:secret-key — that verification is
 * the only path to SUCCESS (requirement 9).
 */
@Injectable()
export class MonnifyPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(MonnifyPaymentProvider.name);
  private cachedToken?: { token: string; expiresAt: number };

  constructor(private readonly config: AppConfigService) {}

  private async accessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) {
      return this.cachedToken.token;
    }

    const credentials = Buffer.from(
      `${this.config.monnifyApiKey}:${this.config.monnifySecretKey}`,
    ).toString('base64');

    const response = await fetch(`${this.config.monnifyBaseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ realmId: this.config.monnifyContractCode }),
    });

    const body = (await response.json()) as {
      requestSuccessful?: boolean;
      responseMessage?: string;
      responseBody?: { accessToken?: string };
    };

    const token = body.responseBody?.accessToken;
    if (!response.ok || !body.requestSuccessful || !token) {
      throw new Error(`Monnify auth failed: ${response.status} ${body.responseMessage}`);
    }

    this.cachedToken = {
      token,
      // Monnify tokens live ~1h; refresh a little early.
      expiresAt: Date.now() + 50 * 60 * 1000,
    };
    return token;
  }

  async initialize(req: InitializePaymentRequest): Promise<ProviderPaymentResult> {
    const token = await this.accessToken();
    const reference = `LAU_${req.idempotencyKey.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}`;
    const meta = (req.metadata ?? {}) as { customerName?: unknown; description?: unknown; callbackUrl?: unknown };

    // Endpoint and field names verified against the Monnify sandbox:
    // POST /api/v1/merchant/transactions/init-transaction with `paymentReference`
    // (not `reference`) and `currencyCode`. The previous
    // `/api/v1/transactions/initialize` + `reference`/`currency` shape was
    // rejected with HTTP 405 by the real sandbox.
    const response = await fetch(
      `${this.config.monnifyBaseUrl}/api/v1/merchant/transactions/init-transaction`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(req.amount * 100) / 100, // 2dp NGN, server-computed
          currencyCode: req.currency,
          customerName: typeof meta.customerName === 'string' ? meta.customerName : 'LAUPAY Customer',
          customerEmail: req.customerEmail,
          paymentReference: reference,
          paymentDescription:
            typeof meta.description === 'string' ? meta.description : 'LAUPAY wallet funding',
          contractCode: this.config.monnifyContractCode,
          redirectUrl: typeof meta.callbackUrl === 'string' ? meta.callbackUrl : undefined,
          paymentMethods: ['CARD', 'ACCOUNT_TRANSFER', 'USSD'],
          metadata: { idempotencyKey: req.idempotencyKey },
        }),
      },
    );

    const body = (await response.json()) as {
      requestSuccessful?: boolean;
      responseMessage?: string;
      responseBody?: { checkoutUrl?: string; transactionReference?: string };
    };

    if (!response.ok || !body.requestSuccessful) {
      this.logger.error(`Monnify initialize failed: ${response.status} ${body.responseMessage}`);
      return { status: 'UNKNOWN', providerReference: reference, raw: body };
    }

    // Monnify's own transactionReference is what the status endpoint keys on,
    // so it becomes the stored providerReference. Our paymentReference is kept
    // in `raw` for correlation (and the webhook falls back to it).
    const transactionReference = body.responseBody?.transactionReference ?? reference;
    this.logger.log(`Monnify checkout initialized: ${transactionReference}`);
    return {
      status: 'PENDING',
      providerReference: transactionReference,
      raw: {
        checkoutUrl: body.responseBody?.checkoutUrl,
        paymentReference: reference,
        transactionReference,
      },
    };
  }

  async verifyTransaction(providerReference: string): Promise<ProviderPaymentResult> {
    try {
      const token = await this.accessToken();
      // Verified against the sandbox: GET /api/v2/transactions/{transactionReference}
      // returns the authoritative status. (/api/v1/... returned 404.)
      const response = await fetch(
        `${this.config.monnifyBaseUrl}/api/v2/transactions/${encodeURIComponent(providerReference)}`,
        { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      );

      const body = (await response.json()) as {
        requestSuccessful?: boolean;
        responseMessage?: string;
        responseBody?: { status?: string; paymentStatus?: string; amount?: number };
      };

      if (!response.ok || !body.requestSuccessful || !body.responseBody) {
        this.logger.warn(`Monnify verify inconclusive for ${providerReference}`);
        return { status: 'UNKNOWN', providerReference, raw: body };
      }

      const status = (body.responseBody.paymentStatus ?? body.responseBody.status)?.toUpperCase();
      const mapped =
        status === 'PAID' || status === 'SUCCESS' || status === 'OVERPAID'
          ? 'SUCCESS'
          : status === 'FAILED' || status === 'REVERSED' || status === 'CANCELLED'
          ? 'FAILED'
          : status === 'PENDING' || status === 'PROCESSING' || status === 'INITIATED'
          ? 'PENDING'
          : 'UNKNOWN';

      return { status: mapped, providerReference, raw: body.responseBody };
    } catch (err) {
      this.logger.error(`Monnify verify error for ${providerReference}: ${String(err)}`);
      return { status: 'UNKNOWN', providerReference };
    }
  }
}