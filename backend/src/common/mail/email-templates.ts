import { firstNameFrom } from '../utils/name.util';

/**
 * Central email copy. Every message shares one calm layout and a single legal
 * footer so brand/consistency never drifts between emails.
 *
 * Consumer brand: LAUPAY
 * Legal entity:   Ibrahim Lau Provision Shop
 */
const BRAND = {
  name: 'LAUPAY',
  legal: 'Ibrahim Lau Provision Shop',
  tagline: 'Everyday digital services. One simple flow.',
  indigo: '#171A4A',
  amber: '#F4B33F',
  muted: '#5B5E80',
  border: '#E6E7F0',
  surface: '#F4F5FA',
} as const;

export interface RenderedEmail {
  subject: string;
  html: string;
}

function layout(body: string): string {
  return `<!doctype html>
<html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
  <body style="margin:0;padding:0;background:${BRAND.surface};">
    <div style="font-family:Inter,Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;color:${BRAND.indigo};">
      <div style="display:flex;align-items:center;gap:9px;font-size:18px;font-weight:800;letter-spacing:-.04em;margin-bottom:20px;">
        <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:8px;background:${BRAND.amber};color:${BRAND.indigo};font-size:16px;">L</span>
        <span>${BRAND.name}</span>
      </div>
      <div style="background:#ffffff;border:1px solid ${BRAND.border};border-radius:16px;padding:28px;">
        ${body}
      </div>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid ${BRAND.border};font-size:12px;line-height:1.7;color:${BRAND.muted};">
        <strong style="color:${BRAND.indigo};">${BRAND.name}</strong><br />
        A service of ${BRAND.legal}<br />
        ${BRAND.tagline}
      </div>
    </div>
  </body>
</html>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:${BRAND.muted};">${text}</p>`;
}

/** Registration email-verification code. */
export function verificationEmail(fullName: string, code: string): RenderedEmail {
  const firstName = firstNameFrom(fullName);
  const body = `
    ${paragraph(`Hi ${firstName},`)}
    ${paragraph('Thank you for creating a LAUPAY account.')}
    ${paragraph('Use this code to verify your email and finish setting up your account:')}
    <div style="background:${BRAND.amber};color:${BRAND.indigo};font-size:32px;letter-spacing:8px;font-weight:700;text-align:center;padding:16px;border-radius:12px;margin:0 0 16px;">${code}</div>
    ${paragraph('This code expires in 10 minutes.')}
    ${paragraph('If you did not request this, you can safely ignore this email. Your account will not be activated.')}
  `;
  return { subject: 'Your LAUPAY verification code', html: layout(body) };
}

/** Password-reset link email. */
export function passwordResetEmail(fullName: string, resetUrl: string): RenderedEmail {
  const firstName = firstNameFrom(fullName);
  const body = `
    ${paragraph(`Hi ${firstName},`)}
    ${paragraph('We received a request to reset the password for your LAUPAY account.')}
    <div style="margin:0 0 16px;">
      <a href="${resetUrl}" style="display:inline-block;background:${BRAND.indigo};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:10px;">Reset your password</a>
    </div>
    ${paragraph('This link expires in 30 minutes.')}
    ${paragraph('If you did not request this, you can safely ignore this email. Your password will not change.')}
  `;
  return { subject: 'Reset your LAUPAY password', html: layout(body) };
}

/** Sent once, after the email is verified and the account becomes active. */
export function welcomeEmail(fullName: string): RenderedEmail {
  const firstName = firstNameFrom(fullName);
  const body = `
    ${paragraph(`Hi ${firstName},`)}
    ${paragraph('Your email is verified and your LAUPAY account is ready.')}
    ${paragraph('You can now fund your wallet and start using airtime, data and payments.')}
    ${paragraph('Thanks for choosing LAUPAY.')}
  `;
  return { subject: 'Welcome to LAUPAY', html: layout(body) };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

/** Responsive transaction receipt/alert. All user- and provider-controlled fields are escaped. */
export function transactionAlertEmail(input: {
  fullName: string;
  alertType: string;
  title: string;
  body: string;
  amount: string;
  currency: string;
  transactionReference: string;
  status: string;
  date: string;
  supportEmail: string;
  narrative?: string;
  availableBalance?: string;
  balanceBefore?: string;
  originalReference?: string;
  originalTransactionId?: string;
  recipient?: string;
  service?: string;
}): RenderedEmail {
  const safe = (value?: string) => value ? escapeHtml(value) : '';
  const isCredit = ['CREDIT', 'REVERSAL', 'REFUND', 'PURCHASE_SUCCESS'].includes(input.alertType);
  const amountColor = input.alertType === 'STATUS_UPDATE' ? '#3554A4' : isCredit ? '#16794B' : '#B54437';
  const rows: Array<[string, string | undefined]> = [
    ['Transaction type', input.alertType.replaceAll('_', ' ')],
    ['Reference', input.transactionReference],
    ['Status', input.status],
    ['Date and time', input.date],
    ['Narration', input.narrative],
    ['Recipient', input.recipient],
    ['Service', input.service],
    ['Original reference', input.originalReference],
    ['Original transaction', input.originalTransactionId],
    ['Balance before', input.balanceBefore ? `${input.currency} ${input.balanceBefore}` : undefined],
    ['Available balance', input.availableBalance ? `${input.currency} ${input.availableBalance}` : undefined],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  const detailRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-size:12px;color:${BRAND.muted};vertical-align:top;width:38%;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-size:12px;color:${BRAND.indigo};font-weight:600;word-break:break-word;">${safe(value)}</td>
    </tr>`).join('');
  const body = `
    <p style="margin:0 0 10px;font-size:14px;color:${BRAND.muted};">Hi ${escapeHtml(firstNameFrom(input.fullName))},</p>
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${BRAND.indigo};">${safe(input.title)}</h1>
    ${paragraph(safe(input.body))}
    <div style="margin:20px 0;background:${BRAND.surface};border-radius:12px;padding:18px;text-align:center;">
      <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.muted};">${escapeHtml(input.currency)} amount</div>
      <div style="margin-top:6px;font-size:27px;line-height:1.2;font-weight:800;color:${amountColor};">${escapeHtml(input.currency)} ${safe(input.amount)}</div>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${detailRows}</table>
    <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:${BRAND.muted};">If you did not authorize this activity, secure your account and contact <a href="mailto:${safe(input.supportEmail)}" style="color:${BRAND.indigo};font-weight:700;">${safe(input.supportEmail)}</a>.</p>
  `;
  return {
    subject: `${input.title} — LAUPAY`,
    html: layout(body),
  };
}
