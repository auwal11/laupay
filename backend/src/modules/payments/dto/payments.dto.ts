import { IsNumber, IsPositive, IsString, IsUUID } from 'class-validator';

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
