import { IsEmail, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const SUPPORT_CATEGORIES = [
  'LOGIN', 'REGISTRATION', 'OTP', 'ACCOUNT_LOCKED', 'PASSWORD_RESET',
  'TECHNICAL_ERROR', 'TRANSACTION', 'WALLET', 'WITHDRAWAL', 'AIRTIME', 'DATA', 'OTHER',
] as const;
export const SUPPORT_STATUSES = ['open', 'in_review', 'awaiting_user', 'in_progress', 'resolved', 'closed'] as const;
export const SUPPORT_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export class CreateSupportTicketDto {
  @IsEmail() contactEmail!: string;
  @IsOptional() @IsString() @MaxLength(120) contactName?: string;
  @IsIn(SUPPORT_CATEGORIES) category!: string;
  @IsString() @MinLength(3) @MaxLength(160) subject!: string;
  @IsString() @MinLength(10) @MaxLength(5000) description!: string;
  @IsOptional() @IsString() @MaxLength(80) sourcePage?: string;
  @IsOptional() @IsString() @MaxLength(160) sourceUrl?: string;
  @IsOptional() @IsString() @MaxLength(80) relatedTransactionId?: string;
  @IsOptional() @IsString() @MaxLength(120) transactionReference?: string;
  @IsOptional() @IsString() @MaxLength(80) errorCode?: string;
  @IsOptional() @IsObject() attachmentMetadata?: Record<string, unknown>;
}

export class SupportMessageDto {
  @IsString() @MinLength(2) @MaxLength(3000) body!: string;
}

export class AdminSupportUpdateDto {
  @IsOptional() @IsIn(SUPPORT_STATUSES) status?: string;
  @IsOptional() @IsIn(SUPPORT_PRIORITIES) priority?: string;
  @IsOptional() @IsString() @MaxLength(80) assignedAdminId?: string;
  @IsOptional() @IsString() @MaxLength(3000) resolutionSummary?: string;
  @IsOptional() @IsString() @MaxLength(5000) adminNotes?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(3000) reply?: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

export class SupportListQueryDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsIn(SUPPORT_STATUSES) status?: string;
  @IsOptional() @IsIn(SUPPORT_CATEGORIES) category?: string;
  @IsOptional() @IsIn(SUPPORT_PRIORITIES) priority?: string;
}
