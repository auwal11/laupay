export type WithdrawalStatus = "PENDING" | "PAID" | "REJECTED";

export interface Withdrawal {
  id: string;
  reference: string;
  amount: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  status: WithdrawalStatus;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawalInput {
  amount: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  pin: string;
  idempotencyKey: string;
}
