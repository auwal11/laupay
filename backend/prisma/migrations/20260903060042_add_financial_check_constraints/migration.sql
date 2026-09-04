ALTER TABLE "WalletAccount"
  ADD CONSTRAINT "wallet_balance_non_negative" CHECK ("balance" >= 0);

ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "ledger_amount_positive" CHECK ("amount" > 0);-- This is an empty migration.
