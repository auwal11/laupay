import { Injectable, Logger } from '@nestjs/common';
import { MailProvider, VerificationMessage } from './mail-provider.interface';

/**
 * Test-only mailer. Records the codes in memory so E2E tests can complete the
 * real Register -> OTP -> Login flow without a live provider or inbox.
 * Selected via MAIL_PROVIDER=mock; never used in staging (requirement 2).
 */
@Injectable()
export class MockMailProvider implements MailProvider {
  private readonly logger = new Logger(MockMailProvider.name);
  static readonly sent: Array<{ to: string; code: string }> = [];

  async sendVerificationCode({ to, code }: VerificationMessage): Promise<void> {
    MockMailProvider.sent.push({ to, code });
    this.logger.debug(`[mock-mail] verification code for ${to}`);
  }

  async sendPasswordReset(): Promise<void> {}

  /** Last code sent to an address — used by the E2E suite. */
  static lastCodeFor(to: string): string | undefined {
    return [...MockMailProvider.sent].reverse().find((m) => m.to === to)?.code;
  }
}
