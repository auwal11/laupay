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

type CheapDataHubResponse = {
  status?: string | boolean;
  message?: string;
  reference?: string;
  transaction_id?: string | number;
  data?: Record<string, unknown>;
};

/** CheapDataHub's documented reseller API. It has no public sandbox. */
@Injectable()
export class CheapDataHubVtuProvider implements VTUProvider {
  private readonly logger = new Logger(CheapDataHubVtuProvider.name);

  constructor(private readonly config: AppConfigService) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.config.cheapDataHubApiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async call(path: string, init: RequestInit): Promise<{ response: Response; body: CheapDataHubResponse }> {
    const response = await fetch(`${this.config.cheapDataHubBaseUrl}${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(this.config.vtuProviderTimeoutMs),
    });
    const body = (await response.json().catch(() => ({}))) as CheapDataHubResponse;
    return { response, body };
  }

  private result(body: CheapDataHubResponse, fallbackReference: string, responseStatus: number): VtuProviderResult {
    const successful = body.status === true || String(body.status).toLowerCase() === 'true';
    const reference = String(body.transaction_id ?? body.reference ?? fallbackReference);
    if (successful) return { status: 'SUCCESS', providerReference: reference, raw: body };
    const message = String(body.message ?? '').toLowerCase();
    if (message.includes('pending') || message.includes('processing') || (responseStatus >= 200 && responseStatus < 300 && !body.status)) {
      return { status: 'PROCESSING', providerReference: reference, raw: body };
    }
    return { status: responseStatus >= 500 ? 'UNKNOWN' : 'FAILED', providerReference: reference, raw: body };
  }

  async getBalance(): Promise<ProviderBalance> {
    try {
      const { response, body } = await this.call('/wallet/balance/', { method: 'GET' });
      const amount = Number(body.data?.balance);
      if (!response.ok || !Number.isFinite(amount)) return { amount: 0, currency: 'NGN' };
      return { amount, currency: 'NGN' };
    } catch (error) {
      this.logger.error(`CheapDataHub balance error: ${String(error)}`);
      return { amount: 0, currency: 'NGN' };
    }
  }

  async listDataPlans(network: string): Promise<DataPlanInfo[]> {
    // The public CheapDataHub docs expose a plan-ID directory but do not
    // document an authenticated JSON catalog endpoint. Deployment supplies
    // the provider's current dashboard plan IDs through CHEAPDATAHUB_PLANS_JSON.
    return this.config.cheapDataHubPlans
      .filter((plan) => plan.network.toUpperCase() === network.toUpperCase())
      .map((plan) => ({
        externalCode: String(plan.bundleId),
        label: plan.label,
        costNaira: plan.price,
        validityDays: plan.validityDays,
      }));
  }

  async purchaseAirtime(req: AirtimePurchaseRequest): Promise<VtuProviderResult> {
    try {
      const { response, body } = await this.call('/airtime/purchase/', {
        method: 'POST',
        body: JSON.stringify({ provider_id: this.providerId(req.network), phone_number: req.phoneNumber, amount: req.amount, request_ref: req.idempotencyKey }),
      });
      return this.result(body, req.idempotencyKey, response.status);
    } catch (error) {
      this.logger.error(`CheapDataHub airtime error: ${String(error)}`);
      return { status: 'UNKNOWN', providerReference: req.idempotencyKey };
    }
  }

  async purchaseData(req: DataPurchaseRequest): Promise<VtuProviderResult> {
    try {
      const bundleId = Number(req.planCode);
      if (!Number.isInteger(bundleId) || bundleId <= 0) return { status: 'FAILED', providerReference: req.idempotencyKey, raw: { message: 'CheapDataHub requires a numeric bundle_id' } };
      const { response, body } = await this.call('/data/purchase/', {
        method: 'POST',
        body: JSON.stringify({ bundle_id: bundleId, phone_number: req.phoneNumber, request_ref: req.idempotencyKey }),
      });
      return this.result(body, req.idempotencyKey, response.status);
    } catch (error) {
      this.logger.error(`CheapDataHub data error: ${String(error)}`);
      return { status: 'UNKNOWN', providerReference: req.idempotencyKey };
    }
  }

  async verifyTransaction(providerReference: string): Promise<VtuProviderResult> {
    try {
      const { response, body } = await this.call(`/transactions/${encodeURIComponent(providerReference)}/`, { method: 'GET' });
      return this.result(body, providerReference, response.status);
    } catch (error) {
      this.logger.error(`CheapDataHub status error: ${String(error)}`);
      return { status: 'UNKNOWN', providerReference };
    }
  }

  private providerId(network: string): number {
    const ids = this.config.cheapDataHubNetworkIds;
    const id = ids[network.trim().toUpperCase() === 'ETISALAT' ? '9MOBILE' : network.trim().toUpperCase()];
    if (!id) throw new Error(`Unsupported network: ${network}`);
    return id;
  }
}
