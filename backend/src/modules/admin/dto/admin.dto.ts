import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class AdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class CreditTestFundsDto {
  @IsUUID()
  userId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  /** Optional client-supplied key so a double-submit cannot credit twice. */
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  autoTestCreditEnabled?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  autoTestCreditAmount?: number;
}

export class UserListQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['CUSTOMER', 'AGENT', 'ADMIN', 'SUPPORT']) role?: string;
  @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class TransactionListQueryDto {
  @IsOptional() @IsIn(['CREDIT', 'DEBIT']) direction?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsIn(['WALLET_FUNDING', 'AGENT_CASH_COLLECTION', 'ORDER_PAYMENT', 'ORDER_REFUND', 'REVERSAL', 'ADMIN_ADJUSTMENT', 'FEE']) reason?: string;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class WalletListQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['ACTIVE', 'FROZEN', 'CLOSED']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class OrderListQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['AIRTIME', 'DATA', 'BILL']) type?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class AuditListQueryDto {
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsUUID() actorId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class DisputeListQueryDto {
  @IsOptional() @IsIn(['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED']) status?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class UpdateDisputeDto {
  @IsIn(['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED'])
  status!: string;
}
