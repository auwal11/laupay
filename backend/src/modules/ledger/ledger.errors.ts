export class InsufficientBalanceError extends Error {
  constructor(walletAccountId: string) {
    super(`Insufficient balance on wallet ${walletAccountId}`);
    this.name = 'InsufficientBalanceError';
  }
}

export class WalletNotActiveError extends Error {
  constructor(walletAccountId: string, status: string) {
    super(`Wallet ${walletAccountId} is not active (status: ${status})`);
    this.name = 'WalletNotActiveError';
  }
}

export class InvalidAmountError extends Error {
  constructor(amount: unknown) {
    super(`Ledger amount must be a positive number, got: ${amount}`);
    this.name = 'InvalidAmountError';
  }
}
