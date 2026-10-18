import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { MailProvider, VerificationMessage } from './mail-provider.interface';
import {
  passwordResetEmail,
  verificationEmail,
  welcomeEmail,
  type RenderedEmail,
} from './email-templates';

/**
 * Brevo transactional email (staging/TEST). Uses the SMTP relay endpoint
 * verified live during setup: POST /v3/smtp/email with `api-key`.
 *
 * NOTE: Brevo enforces an IP allow-list per account. A 401 from here usually
 * means the *host's* outbound IP has not been whitelisted — not a bad key.
 */
@Injectable()
export class BrevoMailProvider implements MailProvider {
  private readonly logger = new Logger(BrevoMailProvider.name);

  constructor(private readonly config: AppConfigService) {}

  async sendVerificationCode({ to, fullName, code }: VerificationMessage): Promise<void> {
    await this.send(to, fullName, verificationEmail(fullName, code), 'verification');
  }

  async sendPasswordReset({
    to,
    fullName,
    resetUrl,
  }: {
    to: string;
    fullName: string;
    resetUrl: string;
  }): Promise<void> {
    await this.send(to, fullName, passwordResetEmail(fullName, resetUrl), 'password reset');
  }

  async sendWelcome({ to, fullName }: { to: string; fullName: string }): Promise<void> {
    await this.send(to, fullName, welcomeEmail(fullName), 'welcome');
  }

  /**
   * Single send path for every message: one place for the sender identity,
   * the allow-list handling and the "never leak a raw provider error" rule.
   */
  private async send(
    to: string,
    fullName: string,
    { subject, html }: RenderedEmail,
    kind: string,
  ): Promise<void> {
    let response: Response;
    try {
      response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': this.config.brevoApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { email: this.config.brevoSenderEmail, name: this.config.brevoSenderName },
          to: [{ email: to, name: fullName }],
          subject,
          htmlContent: html,
        }),
      });
    } catch (err) {
      this.logger.error(`Brevo transport error (${kind}): ${String(err)}`);
      throw new ServiceUnavailableException('Could not send email');
    }

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Brevo ${kind} send failed (${response.status}): ${text}`);
      if (response.status === 401) {
        this.logger.error(
          'Brevo rejected the key — check BREVO_API_KEY and the account IP allow-list.',
        );
      }
      // Deliberately generic: the provider response never reaches the client.
      throw new ServiceUnavailableException('Could not send email');
    }

    const body = (await response.json()) as { messageId?: string };
    this.logger.log(`Brevo ${kind} email accepted: ${body.messageId ?? 'ok'}`);
  }
}
