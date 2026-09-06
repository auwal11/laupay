import { IsString, Matches } from 'class-validator';

/** 4-6 digit numeric PIN only — never anything client-defined beyond that shape. */
const PIN_PATTERN = /^\d{4,6}$/;

export class SetPinDto {
  @IsString()
  @Matches(PIN_PATTERN, { message: 'PIN must be 4 to 6 digits' })
  pin!: string;
}

export class ChangePinDto {
  @IsString()
  @Matches(PIN_PATTERN, { message: 'currentPin must be 4 to 6 digits' })
  currentPin!: string;

  @IsString()
  @Matches(PIN_PATTERN, { message: 'newPin must be 4 to 6 digits' })
  newPin!: string;
}

export class VerifyPinDto {
  @IsString()
  @Matches(PIN_PATTERN, { message: 'PIN must be 4 to 6 digits' })
  pin!: string;
}
