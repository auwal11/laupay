import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

/** Trims and collapses whitespace so stored names are always clean. */
const cleanName = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @Transform(cleanName)
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(['CUSTOMER', 'AGENT'])
  role?: 'CUSTOMER' | 'AGENT';

  /** A validated image data URL. It is stored by the application, never sent to email. */
  @IsOptional()
  @IsString()
  profilePhotoData?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  /** Exactly 6 digits. Rejects anything non-numeric before it reaches the DB. */
  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/, { message: 'code must be a 6-digit number' })
  code!: string;
}

export class ResendOtpDto {
  @IsEmail()
  email!: string;
}
