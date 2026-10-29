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

type VtuAgentResponse = {
  status?: string;
  status_code?: number;
  message?: string;
  reference?: string;
  data?: Record<string, unknown> | Array<Record<string, unknown>>;
};

/** VTUAgent's documented bearer-token API. Secrets never leave the backend. */
@Injectable()
export class VtuAgentVtuProvider implements VTUProvider {
  private readonly logger = new Logger(VtuAgentVtuProvider.name);

  constructor(private readonly config: AppConfigService) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.config.vtuAgentApiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async call(path: string, init: RequestInit): Promise<{ response: Response; body: VtuAgentResponse }> {
    const response = await fetch(`${this.config.vtuAgentBaseUrl}${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(this.config.vtuProviderTimeoutMs),
    });
    const body = (await response.json().catch(() => ({}))) as VtuAgentResponse;
    return { response, body };
  }

  private result(body: VtuAgentResponse, fallbackReference: string): VtuProviderResult {
    const status = String(body.status ?? '').toLowerCase();
    const mapped = status === 'successful' ? 'SUCCESS' : status === 'failed' ? 'FAILED' : status === 'pending' ? 'PROCESSING' : 'UNKNOWN';
    return {
      status: mapped,
      providerReference: String(body.reference ?? fallbackReference),
      raw: body,
    };
  }

  async getBalance(): Promise<ProviderBalance> {
    try {
      const { response, body } = await this.call('/wallet/balance', { method: 'GET' });
      const data = (body.data ?? {}) as Record<string, unknown>;
      const amount = Number(data.balance ?? data.amount);
      if (!response.ok || !Number.isFinite(amount)) return { amount: 0, currency: 'NGN' };
      return { amount, currency: 'NGN' };
    } catch (error) {
      this.logger.error(`VTUAgent balance error: ${String(error)}`);
      return { amount: 0, currency: 'NGN' };
    }
  }

  async listDataPlans(network: string): Promise<DataPlanInfo[]> {
    try {
      const { response, body } = await this.call('/data/plans', { method: 'GET' });
      if (!response.ok || !Array.isArray(body.data)) return [];
      return body.data
        .filter((plan) => String(plan.network ?? '').toUpperCase() === network.toUpperCase() && plan.is_active !== false)
        .map((plan) => ({
          externalCode: String(plan.plan_id ?? plan.id),
          label: String(plan.plan_name ?? plan.name ?? 'Data plan'),
          costNaira: Number(plan.price),
          validityDays: this.validityDays(String(plan.validity ?? '')),
        }))
        .filter((plan) => plan.externalCode && Number.isFinite(plan.costNaira) && plan.costNaira > 0);
    } catch (error) {
      this.logger.error(`VTUAgent data plans error: ${String(error)}`);
      return [];
    }
  }

  async purchaseAirtime(req: AirtimePurchaseRequest): Promise<VtuProviderResult> {
    try {
      const { response, body } = await this.call('/airtime/purchase', {
        method: 'POST',
        body: JSON.stringify({ network: this.network(req.network), phone: req.phoneNumber, amount: req.amount, request_ref: req.idempotencyKey }),
      });
      return this.result(body, req.idempotencyKey);
    } catch (error) {
      this.logger.error(`VTUAgent airtime error: ${String(error)}`);
      return { status: 'UNKNOWN', providerReference: req.idempotencyKey };
    }
  }

  async purchaseData(req: DataPurchaseRequest): Promise<VtuProviderResult> {
    try {
      const { response, body } = await this.call('/data/purchase', {
        method: 'POST',
        body: JSON.stringify({ plan_id: req.planCode, phone: req.phoneNumber, request_ref: req.idempotencyKey }),
      });
      return this.result(body, req.idempotencyKey);
    } catch (error) {
      this.logger.error(`VTUAgent data error: ${String(error)}`);
      return { status: 'UNKNOWN', providerReference: req.idempotencyKey };
    }
  }

  async verifyTransaction(providerReference: string): Promise<VtuProviderResult> {
    try {
      const { response, body } = await this.call('/transaction/status', {
        method: 'POST',
        body: JSON.stringify({ request_ref: providerReference }),
      });
      return this.result(body, providerReference);
    } catch (error) {
      this.logger.error(`VTUAgent status error: ${String(error)}`);
      return { status: 'UNKNOWN', providerReference };
    }
  }

  private network(network: string): string {
    const value = network.trim().toUpperCase();
    return value === '9MOBILE' || value === 'ETISALAT' ? 'etisalat' : value.toLowerCase();
  }

  private validityDays(value: string): number | undefined {
    const match = value.match(/(\d+)\s*day/i);
    return match ? Number(match[1]) : undefined;
  }
}
