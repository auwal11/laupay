export type WithdrawalStatus =
  | "PENDING" | "APPROVED" | "PROCESSING" | "SUCCESSFUL" | "REJECTED"
  | "FAILED" | "REVERSED" | "REFUND_PENDING" | "REFUNDED" | "REFUND_FAILED";

export interface Withdrawal {
  id: string;
  reference: string;
  amount: string;
  bankName: string;
  bankCode?: string;
  accountName: string;
  accountNumber: string;
  status: WithdrawalStatus;
  accountVerified?: boolean;
  fee?: string;
  refundAmount?: string;
  refundStatus?: "PENDING" | "REFUNDED" | "FAILED";
  providerReference?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawalInput {
  amount: string;
  bankName: string;
  bankCode?: string;
  accountName: string;
  accountNumber: string;
  pin: string;
  idempotencyKey: string;
}
