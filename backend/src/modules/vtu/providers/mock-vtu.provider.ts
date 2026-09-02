import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AirtimePurchaseRequest,
  DataPlanInfo,
  DataPurchaseRequest,
  ProviderBalance,
  VTUProvider,
  VtuProviderResult,
} from './vtu-provider.interface';

/**
 * Simulates realistic VTU provider behavior for ₦0-cost development.
 * Same deterministic-by-amount-cents simulation approach as
 * MockPaymentProvider — see that file's docblock for the rule, and
 * docs/architecture/vtu-flow.md §4.
 */
@Injectable()
export class MockVTUProvider implements VTUProvider {
  private readonly logger = new Logger(MockVTUProvider.name);
  private readonly seenRequests = new Map<string, VtuProviderResult>();
  private readonly unknownReferences = new Set<string>();

  async getBalance(): Promise<ProviderBalance> {
    return { amount: 1_000_000, currency: 'NGN' };
  }

  async listDataPlans(network: string): Promise<DataPlanInfo[]> {
    return [
      { externalCode: `${network}-1GB-30D`, label: '1GB - 30 Days', costNaira: 350, validityDays: 30 },
      { externalCode: `${network}-2GB-30D`, label: '2GB - 30 Days', costNaira: 650, validityDays: 30 },
      { externalCode: `${network}-5GB-30D`, label: '5GB - 30 Days', costNaira: 1500, validityDays: 30 },
    ];
  }

  async purchaseAirtime(req: AirtimePurchaseRequest): Promise<VtuProviderResult> {
    return this.simulate(req.idempotencyKey, req.amount);
  }

  async purchaseData(req: DataPurchaseRequest): Promise<VtuProviderResult> {
    // Data purchases don't carry a raw naira amount the same way; derive a
    // pseudo-amount from the plan code so the same simulation rule applies.
    const pseudoAmount = req.planCode.length % 3 === 0 ? 0.01 : req.planCode.length % 5 === 0 ? 0.02 : 0;
    return this.simulate(req.idempotencyKey, pseudoAmount);
  }

  async verifyTransaction(providerReference: string): Promise<VtuProviderResult> {
    if (this.unknownReferences.has(providerReference)) {
      this.unknownReferences.delete(providerReference);
      return { status: 'SUCCESS', providerReference };
    }
    for (const result of this.seenRequests.values()) {
      if (result.providerReference === providerReference) return result;
    }
    return { status: 'UNKNOWN', providerReference };
  }

  private simulate(idempotencyKey: string, amount: number): VtuProviderResult {
    const existing = this.seenRequests.get(idempotencyKey);
    if (existing) {
      this.logger.debug(`[mock-vtu] Duplicate request for ${idempotencyKey}, returning original`);
      return existing;
    }

    const cents = Math.round((amount % 1) * 100);
    const providerReference = `mockvtu_${randomUUID()}`;
    let result: VtuProviderResult;

    if (cents === 1) {
      result = { status: 'FAILED', providerReference };
    } else if (cents === 2) {
      result = { status: 'UNKNOWN', providerReference };
      this.unknownReferences.add(providerReference);
    } else {
      result = { status: 'SUCCESS', providerReference };
    }

    this.seenRequests.set(idempotencyKey, result);
    return result;
  }
}
