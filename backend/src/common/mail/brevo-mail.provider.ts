import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { MailProvider, VerificationMessage } from './mail-provider.interface';

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
    let response: Response;
    try {
      response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': this.config.brevoApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { email: this.config.brevoSenderEmail, name: this.config.brevoSenderName },
          to: [{ email: to, name: fullName }],
          subject: `Your LAUPAY verification code: ${code}`,
          htmlContent: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
            <h2 style="color:#171A4A;margin:0 0 8px">Verify your email</h2>
            <p style="color:#5B5E80;font-size:14px">Hi ${fullName}, use this code to finish creating your LAUPAY account.</p>
            <div style="background:#F4B33F;color:#171A4A;font-size:32px;letter-spacing:8px;
                        font-weight:700;text-align:center;padding:16px;border-radius:12px">${code}</div>
            <p style="color:#5B5E80;font-size:13px;margin-top:16px">
              This code expires in 10 minutes. If you did not create an account, ignore this email.
            </p>
          </div>`,
        }),
      });
    } catch (err) {
      this.logger.error(`Brevo transport error: ${String(err)}`);
      throw new ServiceUnavailableException('Could not send verification email');
    }

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Brevo send failed (${response.status}): ${text}`);
      if (response.status === 401) {
        this.logger.error(
          'Brevo rejected the key — check BREVO_API_KEY and the account IP allow-list.',
        );
      }
      throw new ServiceUnavailableException('Could not send verification email');
    }

    const body = (await response.json()) as { messageId?: string };
    this.logger.log(`Brevo verification email accepted: ${body.messageId ?? 'ok'}`);
  }
}