import { IsNumber, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class RequestWithdrawalDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(100)
  @Max(500_000)
  amount!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  bankName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  accountName!: string;

  @IsString()
  @Matches(/^\d{10}$/, { message: 'accountNumber must be a 10-digit NUBAN' })
  accountNumber!: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'pin must be a 4-digit transaction PIN' })
  pin!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  idempotencyKey!: string;
}
