import { request } from './api';
import type { ApiResult } from '@/types/common';
import type { DisputeReason, TransactionDispute } from '@/types/disputes';
export const disputesService = {
  create(transactionId: string, reason: DisputeReason, details: string): Promise<ApiResult<TransactionDispute>> { return request<TransactionDispute>('/api/disputes', { method: 'POST', body: { transactionId, reason, details } }); },
  list(): Promise<ApiResult<TransactionDispute[]>> { return request<TransactionDispute[]>('/api/disputes'); },
};
