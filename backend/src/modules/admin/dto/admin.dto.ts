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
  IsObject,
  MinLength,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';

export class AdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class CreateStaffAccountDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsIn(['SUPPORT', 'FINANCE', 'VIEWER'])
  role!: 'SUPPORT' | 'FINANCE' | 'VIEWER';

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class CreditTestFundsDto {
  @IsUUID()
  userId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  /** Optional client-supplied key so a double-submit cannot credit twice. */
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  idempotencyKey!: string;
}

export class UpdateSettingsDto {
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

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}


// =====================================================================
// Admin control panel DTOs
// =====================================================================

export class ReasonDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class FreezeUserDto extends ReasonDto {}

export class MarkVerifiedDto extends ReasonDto {
  @IsIn(['email', 'phone'])
  field!: 'email' | 'phone';
}

export class AddNoteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  body!: string;
}

export class SetRoleDto extends ReasonDto {
  @IsIn(['ADMIN', 'SUPPORT', 'FINANCE', 'VIEWER'])
  role!: string;
}

export class WalletCreditDto extends ReasonDto {
  @IsUUID()
  userId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsString()
  @MinLength(16)
  @MaxLength(128)
  idempotencyKey!: string;
}

export class WalletDebitDto extends WalletCreditDto {}

export class ClearTestBalancesDto extends ReasonDto {
  /** One key per confirmed bulk operation; retries are safe and idempotent. */
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  idempotencyKey!: string;
}

export class WalletDebitBalanceDto extends ReasonDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsString()
  @MinLength(16)
  @MaxLength(128)
  idempotencyKey!: string;
}

export class ReverseEntryDto extends ReasonDto {}

export class OrderReasonDto extends ReasonDto {}

export class OpenDisputeDto extends ReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class AssignDisputeDto extends ReasonDto {
  @IsUUID()
  adminId!: string;
}

export class DisputeMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  internal?: boolean;
}

export class DisputeResolutionDto extends ReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateSettingsBodyDto extends ReasonDto {
  @IsObject()
  settings!: Record<string, string>;
}

export class KillSwitchDto extends ReasonDto {
  @IsIn(['service_airtime_enabled', 'service_data_enabled', 'service_wallet_funding_enabled', 'maintenance_mode'])
  key!: string;

  /** true = service is paused; false = running normally. */
  @IsBoolean()
  paused!: boolean;
}

export class ProviderModeDto extends ReasonDto {
  @IsIn(['simulated', 'provider_test', 'live'])
  mode!: string;

  @IsOptional()
  @IsString()
  confirmation?: string;
}

export class BlacklistDto extends ReasonDto {
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  phone!: string;
}

export class RiskListQueryDto {
  @IsOptional() @IsString() severity?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class ReportQueryDto {
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}

export class DisputeIdQueryDto {
  @IsOptional() @IsIn(['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED']) status?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class WithdrawalListQueryDto {
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'PROCESSING', 'SUCCESSFUL', 'REJECTED', 'FAILED', 'REVERSED', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED']) status?: string;
  @IsOptional() @IsString() search?: string;
}

export class RejectWithdrawalDto {
  @IsString() @MinLength(3) @MaxLength(200) reason!: string;
}

export class WithdrawalActionDto {
  @IsString() @MinLength(3) @MaxLength(300) reason!: string;
  @IsOptional() @IsString() @MaxLength(120) providerReference?: string;
  @IsOptional() @IsString() @MaxLength(1000) evidence?: string;
}
