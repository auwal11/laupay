import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { PasswordHasher } from './password-hasher.service';
import { MAIL_PROVIDER } from '../../common/mail/mail-provider.interface';
import { BrevoMailProvider } from '../../common/mail/brevo-mail.provider';
import { MockMailProvider } from '../../common/mail/mock-mail.provider';
import { AppConfigService } from '../../config/app-config.service';
import { ProfileStorageService } from '../../common/storage/profile-storage.service';
import { CreditsModule } from '../credits/credits.module';

/**
 * MAIL_PROVIDER follows the same selection pattern as payment/VTU providers
 * (requirement 2): `brevo` for staging, `mock` for automated tests only.
 * Defaults to mock when the key is absent so a misconfigured environment
 * cannot silently send real email — staging must opt in explicitly.
 */
const mailProviderFactory = {
  provide: MAIL_PROVIDER,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService) =>
    config.mailProvider === 'brevo' ? new BrevoMailProvider(config) : new MockMailProvider(),
};

@Module({
  imports: [JwtModule.register({}), CreditsModule],
  controllers: [AuthController],
  providers: [AuthService, OtpService, PasswordHasher, ProfileStorageService, mailProviderFactory],
  exports: [PasswordHasher, AuthService],
})
export class AuthModule {}
