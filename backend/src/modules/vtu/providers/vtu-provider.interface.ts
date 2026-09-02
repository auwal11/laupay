export type VtuProviderStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN';

export interface AirtimePurchaseRequest {
  network: string;
  phoneNumber: string;
  amount: number;
  idempotencyKey: string;
}

export interface DataPurchaseRequest {
  network: string;
  phoneNumber: string;
  planCode: string;
  idempotencyKey: string;
}

export interface VtuProviderResult {
  status: VtuProviderStatus;
  providerReference: string;
  raw?: unknown;
}

export interface ProviderBalance {
  amount: number;
  currency: string;
}

export interface DataPlanInfo {
  externalCode: string;
  label: string;
  costNaira: number;
  validityDays?: number;
}

/**
 * Every VTU provider (mock or real, e.g. VTPass) implements this interface.
 * See docs/architecture/vtu-flow.md and ADR 0001.
 */
export interface VTUProvider {
  getBalance(): Promise<ProviderBalance>;
  listDataPlans(network: string): Promise<DataPlanInfo[]>;
  purchaseAirtime(req: AirtimePurchaseRequest): Promise<VtuProviderResult>;
  purchaseData(req: DataPurchaseRequest): Promise<VtuProviderResult>;
  verifyTransaction(providerReference: string): Promise<VtuProviderResult>;
}

export const VTU_PROVIDER = Symbol('VTU_PROVIDER');
