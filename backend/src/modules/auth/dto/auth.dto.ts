import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

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
