import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  InitializePaymentRequest,
  PaymentProvider,
  ProviderPaymentResult,
} from './payment-provider.interface';

/**
 * Simulates the full range of real-world provider outcomes so every code
 * path in payment-flow.md is exercised in development/tests without a live
 * provider or spending any money, per the project's ₦0-development-cost
 * requirement.
 *
 * Deterministic simulation rule (based on the amount's cents, so tests are
 * reproducible):
 *   - .00 -> SUCCESS
 *   - .01 -> FAILED
 *   - .02 -> UNKNOWN on initialize, resolves to SUCCESS on verifyTransaction
 *            (simulates a delayed-but-real payment / provider timeout)
 *   - anything else -> SUCCESS (default happy path for convenience)
 *
 * Idempotency: calling initialize() twice with the same idempotencyKey
 * returns the FIRST call's result without creating a second provider-side
 * transaction — this is what proves the caller's own dedup logic is being
 * exercised against realistic provider behavior, not just a rubber-stamp.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);
  private readonly seenRequests = new Map<string, ProviderPaymentResult>();
  private readonly unknownReferences = new Set<string>();

  async initialize(req: InitializePaymentRequest): Promise<ProviderPaymentResult> {
    const existing = this.seenRequests.get(req.idempotencyKey);
    if (existing) {
      this.logger.debug(`[mock] Duplicate initialize for ${req.idempotencyKey}, returning original`);
      return existing;
    }

    const cents = Math.round((req.amount % 1) * 100);
    const providerReference = `mock_${randomUUID()}`;
    let result: ProviderPaymentResult;

    if (cents === 1) {
      result = { status: 'FAILED', providerReference };
    } else if (cents === 2) {
      result = { status: 'UNKNOWN', providerReference };
      this.unknownReferences.add(providerReference);
    } else {
      result = { status: 'SUCCESS', providerReference };
    }

    this.seenRequests.set(req.idempotencyKey, result);
    this.logger.debug(`[mock] initialize(${req.idempotencyKey}) -> ${result.status}`);
    return result;
  }

  async verifyTransaction(providerReference: string): Promise<ProviderPaymentResult> {
    if (this.unknownReferences.has(providerReference)) {
      // Simulate the provider resolving an UNKNOWN payment to SUCCESS on requery —
      // this is what the reconciliation job (payment-flow.md §3) depends on.
      this.unknownReferences.delete(providerReference);
      return { status: 'SUCCESS', providerReference };
    }
    // For already-resolved references, look up their last known status.
    for (const result of this.seenRequests.values()) {
      if (result.providerReference === providerReference) return result;
    }
    return { status: 'UNKNOWN', providerReference };
  }
}
