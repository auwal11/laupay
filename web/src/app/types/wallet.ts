import type { TransactionState } from "./security";

export type TransactionType =
  | "airtime"
  | "data"
  | "wallet_funding"
  | "wallet_debit"
  | "bill_payment"
  | "reversal";

export type TransactionStatus = TransactionState;

export interface WalletBalance {
  /** Minor unit avoided on purpose — backend returns NGN as a decimal string to prevent float drift. */
  ngnBalance: string;
  ngnAvailableBalance: string;
  /** Funds tied up in transactions still resolving (e.g. funding awaiting provider confirmation). */
  ngnPendingBalance?: string;
  /** Funds temporarily held by a risk/security decision — never spendable until released. */
  ngnHeldBalance?: string;
  currency: "NGN";
  updatedAt: string;
}

export interface Transaction {
  id: string;
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  description: string;
  createdAt: string;
  direction?: "credit" | "debit";
  counterparty?: string;
  network?: string;
  providerReference?: string;
  failureReason?: string;
  /** Wallet balance snapshots around this entry, when the backend provides them. */
  balanceBefore?: string;
  balanceAfter?: string;
  /** Provider-hosted checkout URL returned when initiating a sandbox/live funding. */
  checkoutUrl?: string;
}

export interface TransactionDetail extends Transaction {
  /** Recipient phone for airtime/data, or destination account for funding, etc. */
  counterparty?: string;
  network?: string;
  planLabel?: string;
  providerReference?: string;
  failureReason?: string;
  balanceBefore?: string;
  balanceAfter?: string;
}

/** Dedicated bank account a customer transfers into to fund their wallet. */
export interface VirtualAccount {
  provider: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  reference: string;
}

export interface WalletFundingPayload {
  amount: string;
  method: "bank_transfer" | "card";
  idempotencyKey: string;
}
