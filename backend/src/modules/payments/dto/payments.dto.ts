import { IsNumber, IsOptional, IsPositive, IsString, IsUUID, Matches } from 'class-validator';

export class InitializeFundingDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  idempotencyKey!: string;
}

export class ConfirmCashDto {
  @IsUUID()
  orderId!: string;
  // NOTE: no `amount` field, deliberately. The amount debited from the
  // agent's float is always derived server-side from the Order + configured
  // agent pricing (see PaymentsService.computeAgentDebitAmount) — a client-
  // supplied amount on a financial debit would be a direct balance-
  // manipulation vulnerability. See docs/security/security-model.md §3.
}

export class EnsureVirtualAccountDto {
  /**
   * Live deployments require the customer's own 11-digit BVN. It is forwarded
   * to Monnify to create the reserved account and is never persisted.
   * Non-live deployments fall back to a configured sandbox BVN.
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'bvn must be an 11-digit number' })
  bvn?: string;
}
