export type ProviderPaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN';

export interface InitializePaymentRequest {
  amount: number;
  currency: string;
  idempotencyKey: string;
  customerEmail: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderPaymentResult {
  status: ProviderPaymentStatus;
  providerReference: string;
  raw?: unknown;
}

/**
 * Every payment provider (mock or real) implements this interface.
 * Business logic (PaymentsService) only ever talks to this interface —
 * never to a concrete provider SDK directly. See
 * docs/architecture/payment-flow.md and ADR 0001.
 */
export interface PaymentProvider {
  initialize(req: InitializePaymentRequest): Promise<ProviderPaymentResult>;
  verifyTransaction(providerReference: string): Promise<ProviderPaymentResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
