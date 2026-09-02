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

  @IsNumber()
  @IsPositive()
  amount!: number;
}
