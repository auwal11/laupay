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

  async purchaseAirtime(req: AirtimePurchaseRequest): Promise<VtuProviderResult> {
    const requestId = this.requestIdFor(req.idempotencyKey);
    return this.submitPay({
      requestId,
      serviceID: 'mtn',
      billersCode: req.phoneNumber,
      variation_code: 'mtn',
      amount: req.amount,
      phone: req.phoneNumber,
    });
  }

  async purchaseData(req: DataPurchaseRequest): Promise<VtuProviderResult> {
    const requestId = this.requestIdFor(req.idempotencyKey);
    return this.submitPay({
      requestId,
      serviceID: `${req.network}-data`,
      billersCode: req.phoneNumber,
      variation_code: req.planCode,
      amount: 0,
      phone: req.phoneNumber,
    });
  }

  private async submitPay(payload: Record<string, unknown>): Promise<VtuProviderResult> {
    const requestId = String(payload.requestId);
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
      const ref = body.content?.transactions?.transactionId ?? body.transactionId ?? requestId;
      return { status: this.mapCode(body.code), providerReference: String(ref), raw: body };
    } catch (err) {
      this.logger.error(`VTpass /pay error: ${String(err)}`);
      return { status: 'UNKNOWN', providerReference: requestId };
    }
  }

  async verifyTransaction(providerReference: string): Promise<VtuProviderResult> {
    try {
      const response = await fetch(`${this.config.vtpassBaseUrl}/api/re-query`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ requestId: providerReference }),
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