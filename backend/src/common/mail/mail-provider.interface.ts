/**
 * Mail delivery abstraction — same pattern as the payment/VTU provider
 * interfaces (ADR 0001): business logic depends on MAIL_PROVIDER only.
 *
 * `brevo` is used for staging; `mock` is reserved for automated tests so the
 * suite never depends on a live HTTP call or a real inbox.
 */
export interface VerificationMessage {
  to: string;
  fullName: string;
  code: string;
}

export interface MailProvider {
  sendVerificationCode(message: VerificationMessage): Promise<void>;
  sendPasswordReset(message: { to: string; fullName: string; resetUrl: string }): Promise<void>;
  /** Optional, best-effort: sent once the account is activated. */
  sendWelcome(message: { to: string; fullName: string }): Promise<void>;
}

export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');
