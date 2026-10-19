export type DisputeReason = "SERVICE_NOT_DELIVERED" | "FAILED_BUT_DEBITED" | "WRONG_AMOUNT" | "DUPLICATE_TRANSACTION" | "UNRECOGNIZED_TRANSACTION" | "OTHER";
export interface TransactionDispute { id: string; caseReference: string; ledgerEntryId: string; reason: DisputeReason; details?: string | null; status: string; createdAt: string; }
