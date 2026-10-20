import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const BENEFICIARY_NETWORKS = ['MTN', 'AIRTEL', 'GLO', '9MOBILE'] as const;

const normalizePhone = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const compact = value.replace(/[\s()-]/g, '');
  return compact.startsWith('+234') ? `0${compact.slice(4)}` : compact;
};

export class CreateBeneficiaryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  label?: string;

  @Transform(normalizePhone)
  @IsString()
  @Matches(/^(?:\+234|0)[789]\d{9}$/, { message: 'phoneNumber must be a valid Nigerian phone number' })
  phoneNumber!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsIn(BENEFICIARY_NETWORKS, { message: 'network must be MTN, AIRTEL, GLO or 9MOBILE' })
  network!: string;
}

export class UpdateBeneficiaryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  label?: string;

  @IsOptional()
  @Transform(normalizePhone)
  @IsString()
  @Matches(/^(?:\+234|0)[789]\d{9}$/, { message: 'phoneNumber must be a valid Nigerian phone number' })
  phoneNumber?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsIn(BENEFICIARY_NETWORKS, { message: 'network must be MTN, AIRTEL, GLO or 9MOBILE' })
  network?: string;
}
