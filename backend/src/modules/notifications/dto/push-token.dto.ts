import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

const EXPO_PUSH_TOKEN = /^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,256}\]$/;

class PushTokenValueDto {
  @IsString()
  @MaxLength(300)
  @Matches(EXPO_PUSH_TOKEN, { message: 'A valid Expo push token is required' })
  token!: string;
}

export class PushTokenDto extends PushTokenValueDto {
  @IsString()
  @IsIn(['android', 'ios'])
  platform!: 'android' | 'ios';
}

export class RemovePushTokenDto extends PushTokenValueDto {}
