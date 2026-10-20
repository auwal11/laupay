import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service';
import {
  AirtimePurchaseRequest,
  DataPlanInfo,
  DataPurchaseRequest,
  ProviderBalance,
  VTUProvider,
  VtuProviderResult,
} from './vtu-provider.interface';

/**
 * VTpass SANDBOX integration (requirement 7) — real airtime/data fulfilment.
 * `request_id` derives from the project's idempotency key, so a retried order
 * maps onto the SAME VTpass request instead of double-purchasing. VTpass code
 * `000` = success; any ambiguous result maps to UNKNOWN (never FAILED) so the
 * reconciliation job requeries rather than issuing a wrongful reversal.
 */
@Injectable()
export class VtpassVtuProvider implements VTUProvider {
  private readonly logger = new Logger(VtpassVtuProvider.name);

  constructor(private readonly config: AppConfigService) {}

  private headers(): Record<string, string> {
    return {
      'api-key': this.config.vtpassApiKey,
      'secret-key': this.config.vtpassSecretKey,
      'Content-Type': 'application/json',
    };
  }

  private requestIdFor(idempotencyKey: string): string {
    return idempotencyKey.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40) || `${Date.now()}`;
  }

  private mapCode(code: string): VtuProviderResult['status'] {
    if (code === '000') return 'SUCCESS';
    if (code === '016' || code === '017' || code === '018') return 'FAILED';
    if (code === '099') return 'PROCESSING';
    return 'UNKNOWN';
  }

  async getBalance(): Promise<ProviderBalance> {
    try {
      const response = await fetch(`${this.config.vtpassBaseUrl}/api/balance`, {
        method: 'GET',
        headers: this.headers(),
      });
      const body = (await response.json()) as { balance?: number | string };
      if (!response.ok || body.balance === undefined) {
        this.logger.warn(`VTpass balance unavailable: ${response.status}`);
        return { amount: 0, currency: 'NGN' };
      }
      return { amount: Number(body.balance), currency: 'NGN' };
    } catch (err) {
      this.logger.error(`VTpass balance error: ${String(err)}`);
      return { amount: 0, currency: 'NGN' };
    }
  }

  async listDataPlans(network: string): Promise<DataPlanInfo[]> {
    try {
      const response = await fetch(
        `${this.config.vtpassBaseUrl}/api/service-variations?serviceID=${network}-data`,
        { method: 'GET', headers: this.headers() },
      );
      const body = (await response.json()) as {
        content?: {
          variations?: Array<{
            variation_code: string;
            name: string;
            variation_amount: string | number;
          }>;
        };
      };
      return (body.content?.variations ?? []).map((v) => ({
        externalCode: v.variation_code,
        label: v.name,
        costNaira: Number(v.variation_amount),
      }));
    } catch (err) {
      this.logger.error(`VTpass listDataPlans(${network}) error: ${String(err)}`);
      return [];
    }
  }

  /**
   * Maps the platform's network code to VTpass's serviceID. VTpass uses the
   * historic "etisalat" identifier for 9mobile; every other network maps to its
   * lowercase code. Previously airtime was hardcoded to `mtn`, which would have
   * sent every non-MTN top-up to the wrong service.
   */
  private serviceIdFor(network: string): string {
    const key = (network ?? '').trim().toUpperCase();
    const map: Record<string, string> = {
      MTN: 'mtn',
      AIRTEL: 'airtel',
      GLO: 'glo',
      '9MOBILE': 'etisalat',
      ETISALAT: 'etisalat',
    };
    return map[key] ?? key.toLowerCase();
  }

  async purchaseAirtime(req: AirtimePurchaseRequest): Promise<VtuProviderResult> {
    const requestId = this.requestIdFor(req.idempotencyKey);
    const serviceId = this.serviceIdFor(req.network);
    return this.submitPay({
      request_id: requestId,
      serviceID: serviceId,
      billersCode: req.phoneNumber,
      variation_code: serviceId,
      amount: req.amount,
      phone: req.phoneNumber,
    });
  }

  async purchaseData(req: DataPurchaseRequest): Promise<VtuProviderResult> {
    const requestId = this.requestIdFor(req.idempotencyKey);
    return this.submitPay({
      request_id: requestId,
      serviceID: `${this.serviceIdFor(req.network)}-data`,
      billersCode: req.phoneNumber,
      variation_code: req.planCode,
      amount: 0,
      phone: req.phoneNumber,
    });
  }

  private async submitPay(payload: Record<string, unknown>): Promise<VtuProviderResult> {
    // VTpass's /pay contract uses the snake_case `request_id` field; sending
    // `requestId` was silently ignored and the call rejected with code 011
    // ("request_id ID is empty"). Verified against the sandbox.
    const requestId = String(payload.request_id ?? '');
    try {
      const response = await fetch(`${this.config.vtpassBaseUrl}/api/pay`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        code?: string;
        content?: { transactions?: { status?: string; transactionId?: string } };
        transactionId?: string;
      };
      if (!response.ok || !body.code) {
        return { status: 'UNKNOWN', providerReference: requestId, raw: body };
      }
      // Store OUR request_id as the providerReference: VTpass re-query keys on
      // `request_id` (verified against the sandbox — it rejects `transaction_id`
      // with code 011), so the provider's transactionId cannot be used for
      // reconciliation. The transactionId remains in `raw` for webhook lookup.
      return { status: this.mapCode(body.code), providerReference: requestId, raw: body };
    } catch (err) {
      this.logger.error(`VTpass /pay error: ${String(err)}`);
      return { status: 'UNKNOWN', providerReference: requestId };
    }
  }

  async verifyTransaction(providerReference: string): Promise<VtuProviderResult> {
    try {
      // VTpass's re-query route is `/api/requery` (verified against the
      // sandbox — `/api/re-query` returns 404) and it keys on `request_id`.
      const response = await fetch(`${this.config.vtpassBaseUrl}/api/requery`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ request_id: providerReference }),
      });
      const body = (await response.json()) as {
        code?: string;
        content?: { transactions?: { status?: string } };
      };
      if (!response.ok || !body.code) {
        return { status: 'UNKNOWN', providerReference, raw: body };
      }
      return { status: this.mapCode(body.code), providerReference, raw: body };
    } catch (err) {
      this.logger.error(`VTpass verifyTransaction error: ${String(err)}`);
      return { status: 'UNKNOWN', providerReference };
    }
  }
}