import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { PasswordHasher } from './password-hasher.service';
import { LoginThrottleService } from './login-throttle.service';
import { MAIL_PROVIDER } from '../../common/mail/mail-provider.interface';
import { BrevoMailProvider } from '../../common/mail/brevo-mail.provider';
import { MockMailProvider } from '../../common/mail/mock-mail.provider';
import { AppConfigService } from '../../config/app-config.service';
import { ProfileStorageService } from '../../common/storage/profile-storage.service';

/**
 * MAIL_PROVIDER follows the same selection pattern as payment/VTU providers
 * (requirement 2): `brevo` for staging, `mock` for automated tests only.
 * Defaults to mock when the key is absent so a misconfigured environment
 * cannot silently send real email — staging must opt in explicitly.
 */
const mailProviderFactory = {
  provide: MAIL_PROVIDER,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService) => {
    if (config.mailProvider === 'brevo') return new BrevoMailProvider(config);
    if (config.mailProvider !== 'mock') {
      throw new Error(`[config] Unsupported MAIL_PROVIDER=${config.mailProvider}.`);
    }
    if (config.isProduction) {
      throw new Error('[config] Refusing to start with MAIL_PROVIDER=mock in production.');
    }
    return new MockMailProvider();
  },
};

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, OtpService, PasswordHasher, ProfileStorageService, LoginThrottleService, mailProviderFactory],
  exports: [PasswordHasher, AuthService, MAIL_PROVIDER],
})
export class AuthModule {}
